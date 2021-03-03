//Worker related tasks

//Dependencies
var path = require('path');
var fs = require('fs');
var _data = require('./data');
var https = require('https');
var http = require('http');
var helpers = require('./helpers');
var url = require('url');
var _logs = require('./logs');



//Instantiate the worker object
var workers = {};

// Look up all checks, get their data, send to validator

workers.gatherAllChecks = function(){

	//Get all the checks 
	_data.list('checks',function(error,checks){
		if(!error && checks && checks.length >0){

			checks.forEach(function(check){
				//Read in the check data
				_data.read('checks',check,function(error,originalCheckData){
					if(!error&& originalCheckData){

						//Pass it to the check validator and let that function continue or log errors as needed
						workers.validateCheckData(originalCheckData);

					}else{

						console.log('Error reading on of the checks data');

					}
				});
			});

		}else{
			console.log("Error : Could not find any checks to processs");
		}

	});
};	

// Sanity-Check the check-data
workers.validateCheckData = function(originalCheckData){
	originalCheckData = typeof(originalCheckData) =='object' && originalCheckData !== null ? originalCheckData : {};
	originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
	originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
	originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http','https'].indexOf(originalCheckData.protocol)> -1 ? originalCheckData.protocol.trim() : false;
	originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
	originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['post','get','put','delete'].indexOf(originalCheckData.method)> -1 ? originalCheckData.method.trim() : false;
	originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length >0 ? originalCheckData.successCodes : false;
	originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' &&  originalCheckData.timeoutSeconds %1 ===0  && originalCheckData.timeoutSeconds>=1 && originalCheckData.timeoutSeconds<=5 ? originalCheckData.timeoutSeconds : false;


	//Set the keys that may not be set (if the workers have not seen this check before)
	originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up','down'].indexOf(originalCheckData.state)> -1 ? originalCheckData.state : 'down';
	originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' &&  originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

	// If all the checks pass, pass the data along to the next step in the process
	if(originalCheckData.id && 
		originalCheckData.userPhone &&
		originalCheckData.protocol &&
		originalCheckData.url &&
		originalCheckData.method &&
		originalCheckData.successCodes &&
		originalCheckData.timeoutSeconds
		){

		workers.performCheck(originalCheckData);

	}else{
		console.log('Error : One of the checks is not properly formated, skipping it');
	}

};


//Perform the check send the originalCheckData and the outcome of the check processs to the next step in the process
workers.performCheck = function(originalCheckData){
	//Prepare the inital check outcome
	var checkOutCome = {
		'error' : false,
		'responseCode' : false
	};

	//Mark that the outcome has not been sent yet
	var outcomeSent = false;

	//Parse the hostname and the path out of the original  check data
	var parsedUrl = url.parse(originalCheckData.protocl  + '://' + originalCheckData.url,true);
	var hostName = parsedUrl.hostname;
	var path = parsedUrl.path; //Using path and not "pathname" because we want the query string

	//Construct the request
	var requestDetails = {
		'protocol' : originalCheckData.protocol+':',
		'hostname' : hostName,
		'method' : originalCheckData.method.toUpperCase(),
		'path' : path,
		'timeout' : originalCheckData.timeoutSeconds * 1000
	};

	//Instantiate the request object (using either the http or the https module)
	var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;	

	//Craft the request
	var request = _moduleToUse.request(requestDetails,function(response){
		//Grab the staus of the sent request
		var status = response.statusCode;

		//Update the check outcome and pass the data along
		checkOutCome.responseCode = status;
		if(!outcomeSent){
			workers.processCheckOutcome(originalCheckData,checkOutCome);
			outcomeSent = true;
		};

	});


	//Bind to the error event so it does not get thrown
	request.on('error',function(error){
		//Update the check outcome and pass the data along
		checkOutCome.error = {
			'error' : true,
			'value' : error
		};

		if(!outcomeSent){
			workers.processCheckOutcome(originalCheckData,checkOutCome);
			outcomeSent = true;
		}
	});


	//Bind to the timeout event	
		request.on('timeout',function(error){
			//Update the check outcome and pass the data along
			checkOutCome.error = {
				'error' : true,
				'value' : 'timeout'
			};

			if(!outcomeSent){
				workers.processCheckOutcome(originalCheckData,checkOutCome);
				outcomeSent = true;
			}
		});

	//End send the request
		request.end();
};

//Process the check outcome and update the check data as needed  and trigger an alert to the user 
//Special logic for accomodating a check that has never been tested before ( dont alert on it)

workers.processCheckOutcome = function(originalCheckData,checkOutCome){
	//Decide if the check is considered up or down 
	var state = !checkOutCome.error && checkOutCome.responseCode && originalCheckData.successCodes.indexOf(checkOutCome.responseCode) > -1 ? 'up' : 'down' ;

	//Decide if an alert is warranted
	var alertWarranted = originalCheckData.lastChecked && originalCheckData.state != state ? true : false;

	//Log the outcome
	var timeOfCheck = Date.now();
	workers.log(originalCheckData,checkOutCome,state,alertWarranted,timeOfCheck);
	//Update the check data
	var newCheckData = originalCheckData;
	newCheckData.state = state;
	newCheckData.lastChecked = Date.now();

	//Save the updates
	_data.update('checks',newCheckData.id,newCheckData,function(error){
		if(!error){
			//Send the new check data to the next phase in the process if needed
			if(alertWarranted){
				workers.alertUserToStatusChange(newCheckData);
			}else{
				console.log('Check outcome has not changed, no alert needed');
			}
		}else{
			console.log('Error trying to save updates to one of the checks');
		}
	});
};

//Alert the user as to a change in their check status
workers.alertUserToStatusChange = function(newCheckData){
	var message = 'Alert : YOur check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol+'://'+newCheckData.url +' is currently : ' + newCheckData.state;

	helpers.sendTwilioSms(newCheckData.userPhone,message,function(error){
		if(!error){
			console.log('Sucess : User was alerted to a status change in their check, via sms');
		}else{
			console.log('Error : Could not send sms alert to user who had a state change in their change');
		}
	});
};


workers.log = function(originalCheckData,checkOutCome,state,alertWarranted,timeOfCheck){
	//Form the log data
	var logData = {
		'check' : originalCheckData,
		'outcome' : checkOutCome,
		'state' : state,
		'alert' : alertWarranted,
		'time' : timeOfCheck
	};

	//Convert data to a string
	var logString = JSON.stringify(logData);

	//Determine the name of the log file
	var logFileName = originalCheckData.id;

	//Append the log string to the file
	_logs.append(logFileName,logString,function(error){
		if(!error){
			console.log('Loggin to file succeeded');
		}else{
			console.log('Loggin to file failed');
		}
	})	
};


//Rotate (compress) the log files
workers.rotateLogs = function(){
	//List all the (non compressed) log files
	_logs.list(false, function(error,logs){
		if(!error && logs && logs.length >0){
			logs.forEach(function(logName){
				//Compress the data to a diferent file

				var logId = logName.replace('.log','');
				var newFileId = logId+'-'+Date.now();
				_logs.compress(logId,newFileId,function(error){
					if(!error){
						//Truncate log
						_logs.truncate(logId,function(error){
							if(!error){
								console.log('Success truncating log file');
							}else{
								console.log('Error truncating log file');
							}
						})
					}else{
						console.log('Error compressing on of the log files' , error);
					}
				})
			});
		}else{
			console.log('Error, could not find any logs to rotate');
		}
	});
};






//Timer to execute the log rotation process once per day
workers.logRotationLoop = function(){
	
	setInterval(function(){
		workers.rotateLogs();
	},1000*60 * 60* 24 );

}




//Timer to execute the worker processs once per minute
workers.loop = function(){

	setInterval(function(){
		workers.gatherAllChecks();
	},1000*60);

};	

//Init script
workers.init = function(){

	// Execute all the checks inmediately
	workers.gatherAllChecks();

	// Call the loop so the checks will execute later on their on
	workers.loop();

	// Compress all the logs inmediatly
	workers.rotateLogs();

	//Call the compression loop so logs will be compressed later on
	workers.logRotationLoop();	
};




//Export the module
module.exports = workers;