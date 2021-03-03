//Helpers for various tasks

//Depedencies
var crypto = require('crypto');
var config = require('./config');
var https = require('https');
var querystring = require('querystring');

//Container for all helpers

var helpers = {};


//Create a SHA256 hash

helpers.hash = function(string){
	if(typeof(string) == 'string' && string.length>0){
		console.log(config);
		var hash = crypto.createHmac('sha256',config.hashingSecret).update(string).digest('hex');
		return hash;
	}else{
		return false;
	}
};


// Parse a JSON string to an object in all cases without throwing
helpers.parseJsonToObject = function(string){
	try{
		var obj = JSON.parse(string);
		return obj;

	}catch(e){
		console.log(e);
		return {};
	}
}


//Create a string of random aplhanumeric characters of a given length
helpers.createRandomString = function(stringLenght){
	stringLenght = typeof(stringLenght) == 'number' && stringLenght > 0 ? stringLenght : false;

	if(stringLenght){
		var possibleCharacters = 'qwertyuioplkjhgfdsazxcvbnm0123456789';

		//Start the final string
		var string = '';
		for(i = 1 ; i<=stringLenght ; i++){

			//Get a random character from the possible ones
			var randomCharacter =possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length ) ); 

			//Append this character to the final string
			string+=randomCharacter;
		}	

		return string;
	}else{
		return false;
	}
}


//Send an SMS message via Twilio

helpers.sendTwilioSms = function(phone,message,callback){
	//Validate parameters
	phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
	message = typeof(message) == 'string' && message.trim().length > 0 && message.trim().length<= 1600 ? message.trim() : false;

	if(phone && message){
		//Config the request payload
		var payload = {
			'From' : config.twilio.fromPhone,
			'To' : '+52'+phone,
			'Body' : message
		};

		//Stringify the payload
		var stringPayload = querystring.stringify(payload);

		//Configure the request details
		var requestDetails = {
			'protocol' : 'https:',
			'hostname' : 'api.twilio,com',
			'method' : 'POST',
			'path' : '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
			'auth' : config.twilio.accountSid+':'+config.twilio.authToken,
			'headers':{
				'Content-Type' : 'application/x-www-form-urlencoded',
				'Content-Length' : Buffer.byteLength(stringPayload)
			}

		};	


		//Instancete the request object
		var request = https.request(requestDetails,function(response){
			//Grab the status of the sent request
			var status = response.statusCode;
			//Callback successfully if the request went through

			if(status==200 || status==201){
				callback(false);
			}else{
				callback('Status code returned was' + status);
			}
		});

		//Bind to the error event so it does not get thrown
		request.on('error',function(error){
			callback(error);
		});

		//Add the payload
		request.write(stringPayload);
		
		//End the request (send it to twilio)
		request.end();	



	}else{
		callback('Given parameters were missing or invalid');
	}
};


helpers.placeOrderToStripe = function(amount,callback){
				const payload={
		            'amount': amount,
		            'currency':'usd',
		            'source': 'tok_visa'
		        };
		    
		        const stringPayload=querystring.stringify(payload);
		    
		        const requestDetails={
		            'auth': 'sk_test_acEvUiW4UAmKT0y1lybVUT8l:' ,
		            'protocol':'https:',
		            'hostname':'api.stripe.com',
		            'path': '/v1/charges',
		            'method':'POST',
		            'headers':{        
		                'Content-Type': 'application/x-www-form-urlencoded',
		                'Content-Length': Buffer.byteLength(stringPayload)
		            }
		        };


		        const req=https.request(requestDetails,(res)=>{
            		const status=res.statusCode;
			    	if(status==200 || status==201){
			                callback(false);
			            }
			            else{
			                callback('Status code returned was '+status);
			            }
			    });
			    
			        req.on('error',(e)=>{
			            callback(e);
			        });
			    
			        req.write(stringPayload);
			    
			        req.end();

};

helpers.sendEmail=(to, body,callback)=>{
 
    const payload={
        'from': '',
        'to': to,
        'subject': 'Order Confirmation',
        'text': body
    };

    const stringPayLoad=querystring.stringify(payload)

    const requestDetails={
        'protocol':'https:',
        'hostname':'api.mailgun.net',
        'method':'POST',
        'path':'',
        'auth': 'api:',
        'headers':{
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(stringPayLoad)
        }
    };

    const req=https.request(requestDetails,(res)=>{
       const status=res.statusCode;

       console.log(status)
       if(status==200 || status==201){
        callback(false);
       }
       else{
           callback('Error occured while sending mail, code: '+status);
       }
    });

    req.on('error',(e)=>{
    	console.log(e);
     callback(e);
    });

    req.write(stringPayLoad);

    req.end();

};





//Export the module
module.exports = helpers;