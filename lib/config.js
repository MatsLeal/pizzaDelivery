/*


Create and export configuration variables


*/

// Container for all the enviroments

var enviroments = {};


// Staging (default) enviroment
enviroments.staging = {
	'httpPort' : 3000,
	'httpsPort' : 3001,
	'envName' : 'staging',
	'hashingSecret': 'secret',
	'maxChecks' : 5,
	'twilio' :{
		'accountSid' : 'ACb32d411ad7fe886aac54c665d25e5c5d',
	    'authToken' : '9455e3eb3109edc12e3d8c92768f7a67',
	    'fromPhone' : '+15005550006'	
	}
};

// Production` enviroment
enviroments.production = {
	'httpPort' : 5000,
	'httpsPort' : 5001,
	'envName' : 'production',
	'hashingSecret': 'secret',
	'maxChecks' : 5,
	'twilio' :{
		'accountSid' : '',
		'authToken' : '',
		'formPhone' : ''
	}

};

// Determine which enviroment was passed as a comand line argument

var currentEnviroment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

//Chech that current enviroment is one of the enviroments above, if not found default to staging
var enviromentToExport = typeof(enviroments[currentEnviroment]) == 'object' ? enviroments[currentEnviroment] : enviroments.staging;

//Export the module

module.exports =enviromentToExport;