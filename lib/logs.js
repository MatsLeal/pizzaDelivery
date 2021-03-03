//
// Libary for storing and rotating logs
//
//


//Dependencies
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

//Container for the module

var lib = {};

lib.baseDirectory = path.join(__dirname,'/../.logs/');


//Append a string to a file. Create the file if it does not exist
lib.append = function(file,string,callback){
	//Open the file for appending
	fs.open(lib.baseDirectory+file+'.log','a',function(error,fileDescriptor){
		if(!error && fileDescriptor){

			fs.appendFile(fileDescriptor,string+'\n',function(error){
				if(!error){
					fs.close(fileDescriptor,function(error){
						if(!error){
							callback(false);
						}else{
							callback('Error closing file that was being appended');
						}
					})
				}else{
					callback('Error appending to file');
				}
			});

		}else{
			callback('Could not open file for appending');
		}
	})

};

//List all the logs and optionally include the compressed logs
lib.list = function(includeCompressedLogs,callback){
	fs.readdir(lib.baseDirectory,function(error,data){
		if(!error && data && data.length >0){
			var trimmedFileNames = [];
			data.forEach(function(fileName){
				//Add the .log files
				if(fileName.indexOf('.log')	> -1){
					trimmedFileNames.push(fileName.replace('.log',''));
				}


				//Add the compressed files .gz files
				if(fileName.indexOf('.gz.b64')> -1 && includeCompressedLogs){
					trimmedFileNames.push(fileName.replace('.gs.b64',''));
				}

				callback(false,trimmedFileNames);


			});
		}else{
			callback(error,data);
		}
	})
};



//Compress the contents of one log file into a .gz.b64 within the same directory
lib.compress = function(logId,newFileId,callback){
	var sourceFile = logId + '.log';
	var destinationFile = newFileId + '.gz.b64';

	//Read the sources file
	fs.readFile(lib.baseDirectory+sourceFile,'utf-8',function(error,inputString){
		if(!error && inputString){
			//Compress the data using gzip
			zlib.gzip(inputString,function(error,buffer){
				if(!error && buffer){
					//Send the data to the destination file
					fs.open(lib.baseDirectory+destinationFile,'wx',function(error,fileDescriptor){
						if(!error && fileDescriptor){
							//Write to destination file
							fs.writeFile(fileDescriptor,buffer.toString('base64'),function(error){
								if(!error){
									//Close destination File
									fs.close(fileDescriptor,function(error){
										if(!error){
											callback(false);
										}else{
											callback(error);
										}
									})
								}else{
									callback(error);
								}
							})
						}else{
							callback(error);
						}
					})
				}else{
					callback(error);
				}
			});
		}else{
			callback(error);
		}
	})
};


//Decompress the contents of a .gz.b64 file into a string variable
lib.decompress = function(fileId,callback){
	var fileName = fileId + '.gz.b64';

	fs.readFile(lib.baseDirectory+fileName,'utf-8',function(error,string){
		if(!error && string){
			//Decompress the data
			var inputBuffer = Buffer.from(string,'base64');
			zlib.unzip(inputBuffer,function(error,outputBuffer){
				if(!error && outputBuffer){
					//Callback
					var string = outputBuffer.toString();
					callback(false,string);
				}else{
					callback(error);
				}
			});
		}else{
			callback(error);
		}
	});
};

// Truncate a log file
lib.truncate = function(logId,callback){
	fs.truncate(lib.baseDirectory+logId+'.log',0,function(error){
		if(!error){
			callback(false);
		}else{
			callback(error);
		}
	});
};






//Export the module
module.exports = lib;