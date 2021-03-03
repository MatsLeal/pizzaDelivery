




// Server related tasks

//Dependencies
var http = require('http');
var https = require('https');
var url = require('url');
var stringDecoder = require('string_decoder').StringDecoder;
var fs = require('fs');
var _data = require('./data');
var handlers = require('./handlers');
var helpers = require('./helpers')
var config = require('./config');
var path = require('path');


//Instantiate the server module object
var server = {};


//Config

// ----------------------HTTP SERVER 
//The server should respond to all requests with a string
server.httpServer = http.createServer(function(request,response){
	server.unifiedServer(request,response);
});



server.httpsServerOptions = {
	'key' : fs.readFileSync(path.join(__dirname,'/../https/key.pem')) ,
	'cert' : fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
};


server.httpsServer = https.createServer(server.httpsServerOptions,function(request,response){
	server.unifiedServer(request,response);
});



//----------------------------HTTPS SERVER END




// ----------------All the server logic for both the http and https create server
server.unifiedServer = function(request,response){

	//Get the url and parse it
	var parsedUrl = url.parse(request.url,true);

	//Get the path of the URL
	var path = parsedUrl.pathname;
	var trimmedPath = path.replace(/^\/+|\/+$/g,'');

	//Get the query string as an object
	var queryStringObject = parsedUrl.query;


	//Get the http method
	var method = request.method.toLowerCase();


	//Get the headers as an object
	var headers = request.headers;

	//Get the payload if any
	var decoder = new stringDecoder('utf-8');
	var buffer = '';

	request.on('data',function(data){
		buffer += decoder.write(data);
	});

	request.on('end',function(){
		buffer += decoder.end();
		console.log(buffer);	

		//Chose the handler this request go to, if one is not found, use the not found handler
		var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

		//Construct the data object to send to the handler

		var data = {
			'trimmedPath' : trimmedPath,
			'queryStringObject' : queryStringObject,
			'method' : method,
			'headers' : headers,
			'payload' : helpers.parseJsonToObject(buffer)
		};

		//Rout the request to the handler specefied in the router

		chosenHandler(data,function(statusCode, payload){
			// Use the status code callback by the handler or default to handler
			statusCode = typeof(statusCode) == 'number' ? statusCode : 200;


			//Use the payload called back by the handler or default to empty object
			payload = typeof(payload) == 'object' ? payload : {};

			//Convert the payload to a string
			var payloadString= JSON.stringify(payload);

			//Return the response

			//Set the content type to JSON
			response.setHeader('Content-Type','application/json');


			//Write the status code on the response
			response.writeHead(statusCode);

			response.end(payloadString);



		//Log the request path
		console.log('Returning this response' + statusCode + payloadString);
		});





	});

};

//-------------------END of unified server logic 





// Define a request router

server.router = {

	'ping' : handlers.ping,
	'users' : handlers.users,
	'tokens' : handlers.tokens,
	'checks' : handlers.checks,
	'items' : handlers.items,
	'shoppingcart' : handlers.shoppingCart,
	'orders' : handlers.orders
};



//Init script
server.init = function(){
	//Start the HTTP server
	server.httpServer.listen(config.httpPort,function(){
		console.log("The server is listening on port " + config.httpPort );
	});

	//Start the server 
	server.httpsServer.listen(config.httpsPort,function(){
		console.log("The server is listening on port " + config.httpsPort );
	});


};


//Export the server
module.exports = server;