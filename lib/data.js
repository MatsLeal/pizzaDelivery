// Libary for storing and editing data

// Dependencies

var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');

//Container for the module to be exported

var lib = {};

// Define base directory for the data folder

lib.baseDirectory = path.join(__dirname,'/.././.data/');


//Write data to a file
lib.create = function(directory,file,data,callback){

	//Open the file for writing
	fs.open(lib.baseDirectory + directory + '/' + file + '.json','wx',function(error,fileDescriptor){
		if(!error && fileDescriptor){

			//Convert data to string
			var stringData = JSON.stringify(data);

			//Write to file and close it
			fs.writeFile(fileDescriptor,stringData,function(error){

				//Close data
				if(!error){
					fs.close(fileDescriptor,function(error){
						if(!error){
							callback(false);
						}else{
							callback('Error closing new file');
						}
					});
				}else{
					callback('Error writing to new file');
				}
			});

		}else{
			callback('Could not create new file, it may already exist');
		}
	});
};



//Read data from file
lib.read = function(directoryName,fileName,callback){
	fs.readFile(lib.baseDirectory+ directoryName + '/' + fileName+'.json','utf8',function(error,data){
		if(!error && data){
			var parsedData = helpers.parseJsonToObject(data);
			callback(false,parsedData);
		}else{
			callback(error,data);
		}
	});
};


// Update data inside a file
lib.update = function(directory,fileName,data,callback){

	//Open the file for writing
	fs.open(lib.baseDirectory+directory+'/' +fileName + '.json','r+',function(error,fileDescriptor){
		//
		if(!error && fileDescriptor){
			var stringData = JSON.stringify(data);

			//Truncate the file
			fs.truncate(fileDescriptor,function(error){
				if(!error){
					//Write data and close the file
					fs.writeFile(fileDescriptor,stringData,function(error){
						if(!error){
							fs.close(fileDescriptor,function(error){
								if(!error){
									callback(false);
								}else{
									callback('Error closing the file in update method')
								}
							});
						}else{
							callback('Error writing to existing file');
						}
					});
				}else{
					callback('Error truncating file in updating data method');
				}
			});
		}else{
			callback('Could not open the file for updating, it may not exist yet');
		}
	});
};


//Delete the file

lib.delete = function(directory,fileName,callback){
	//Unlink the file
	fs.unlink(lib.baseDirectory+directory+'/'+fileName+'.json',function(error){
		if(!error){
			callback(false);
		}else{
			callback('Error deleting the file ');
		}
	});
};


//List all the items in a directory
lib.list= function(directory,callback){
	fs.readdir(lib.baseDirectory+directory+'/',function(error,data){

		if(!error && data && data.length > 0){
			var trimmedFileNames = [];
			data.forEach(function(fileName){
				trimmedFileNames.push(fileName.replace('.json',''));
			});

			callback(false,trimmedFileNames);

		}else{
			callback(error,data);
		}
	});
};


//Export it

module.exports = lib;