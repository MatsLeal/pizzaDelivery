// Request handlers


//Dependencies
var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config')
var url = require('url');
var https = require('https');

//Define the handlers
var handlers = {};

handlers.ping = function (data,callback){
	callback(200);
};


// Define the not found handler
handlers.notFound = function(data,callback){
	callback(404);
};


// ======================== USERS HANDLERS

handlers.users = function(data,callback){
	var acceptableMethods = ['post','get','put','delete'];
	if(acceptableMethods.indexOf(data.method) > -1 ){
		handlers._users[data.method](data,callback);
	}else{
		callback(405);
	}

};



//==========================================================Container for the users submethods

handlers._users = {};

// Users post
//Required data : firstName,lastName, `phone`, password, tosAgreement
//Opt data : none
handlers._users.post = function(data,callback){
	//Check that all the required fields are filled out
	var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
	var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
	var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
	var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
	console.log(data.payload);
	if(name &&  phone && password && email){
		//Make sure that the user does not already exists
		//Atempt to read the user, if we have an error, the user does not exist
		_data.read('users',phone,function(error,data){
			if(error){
				//Hash the password
				var hashedPassword = helpers.hash(password);

				//Generate Shopping Cart ID
				var shoppingCartId = helpers.createRandomString(20);

				// Create the user object

				if(hashedPassword){

					var userObject = {
						'name': name,
						'email' : email,
						'phone' : phone,
						'hashedPassword':hashedPassword,
						'shoppingCartId' : shoppingCartId
					};

					//Store the user
					_data.create('users',phone,userObject,function(error){
						if(!error){

							//Create the Shopping cart in disk

							_data.create('shoppingcart',shoppingCartId,{'userId' : phone},function(error){
								if(!error){
									callback(200,{'Message' : 'User and shopping cart created !'});
								}else{
									callback(500,{'Error' : 'Could not create shopping cart'});
								}
							});
							//callback(200);
						}else{
							console.log(error);
							callback(500,{'Error': 'Could not create the new user'});	
						}
					});

				}else{
					callback(500,{'Error': ' Could not hash the user password'});
				}

				
			}else{
				//User already exists
				callback(400,{'Error' : ' A user with that phone number already exists'});
			}
		});

	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}
}
// Users get
// Required data : phone
// optional data : none
handlers._users.get = function(data,callback){
	//Check that the phone number provided is valid
	var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
	if(phone){

		//Get the token from the headers
		var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

		//Verify that the given token is valid for the phone number

		handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
			if(tokenIsValid){

				//Lookup the user
				_data.read('users',phone,function(error,data){
					if(!error && data){
						//Remove the hashed password from the user object before returning it to the requester
						delete data.hashedPassword;
						callback(200,data);
					}else{
						callback(404);
					}
				});

			}else{
				callback(403,{'Error' : 'Missing required token in header or token is invalid'});
			}
		})




	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}
}
// Users put
// Required Data : phone
//Optional data : firstName, lastName, password ( at least one must be specified)
handlers._users.put = function(data,callback){
	//Check for the required field	
	var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

	//Check for the optional fields
	var name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
	var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
	var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

	//Error if the phone is invalid
	console.log("PHONE" , phone);
	if(phone){
		//Error if nothing is sent to update
		if(name || email|| password ){

			//Get the token from the headers
			var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

			handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
			if(tokenIsValid){

					//Lookup the user
					_data.read('users',phone,function(error,userData){
						if(!error && userData){
							//Update necesary fields
							if(name){
								userData.name=name;
							}
							if(email){
								userData.email=email;
							}
							if(password){
								userData.hashedPassword=helpers.hash(password);
							}

							//Store the new updates
							_data.update('users',phone,userData,function(error){
								if(!error){
									callback(200);
								}else{
									console.log(error);
									callback(500,{'Error': 'Could not update the user'});
								}
							})
						}else{
							callback(400,{'Error': 'The specified user does not exist'});
						}
					});

			}else{
				callback(403,{'Error':'Missing token'});
			}
		});


		}else{
			callback(400,{'Error': 'Missing fields to update'});
		}
	}else{
		callback(400,{'Error': 'Missing required field'})
	}
}
// Users delete
// Required field : phone
handlers._users.delete = function(data,callback){
	//Chech that the phone number is valid
	var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
	
	var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

	handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
	if(tokenIsValid){

			if(phone){
						//Lookup the user
				_data.read('users',phone,function(error,userData){
					if(!error && userData){
						_data.delete('users',phone,function(error){
							if(!error){
								
								//Delete each of the checks assosiated with the user
								var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
								var checksToDelete = userChecks.length;
								if(checksToDelete>0){

									var checksDeleted = 0;
									var deletionErrors = false;

									//Loop through the checks
									userChecks.forEach(function(checkId){
										//Delete the check
										_data.delete('checks',checkId,function(error){
											if(error){
												deletionErrors = true;
											}
											checksDeleted++;
											if(checksDeleted == checksToDelete){
												if(!deletionErrors)	{
													callback(200);
												}else{
													callback(500,{'Error' : 'Errors encountered while to attempint to delete all of the user checks, all checks may not have been deleted from the system successfullly'});
												}
											}
										})
									});

								}else{
									callback(200);
								}



							}else{
								callback(500,{'Error' : 'Could not delete the specified user'});
							}
						});
					}else{
						callback(400,{'Error' : 'Could not find the specified user'});
					}
				})
			}else{
				callback(400,{'Error' : 'Missing required fields'});
			}


	}else{
		callback(403,{'Error' : 'Missing token, operation not allowed'});
	}});

}
// ============================================================= USERS HANDLERS END

// ==================================TOKENS HANDLERS============================================

handlers.tokens = function(data,callback){
	var acceptableMethods = ['post','get','put','delete'];
	if(acceptableMethods.indexOf(data.method) > -1 ){
		handlers._tokens[data.method](data,callback);
	}else{
		callback(405);
	}

};
//Container all the tokens methods
handlers._tokens = {};


//Tokens - post
//Required data : phone password
//Optional data : none
handlers._tokens.post = function(data,callback){

	var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
	var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
	if(phone && password){
			//Lookup the user who matches that phone number
			_data.read('users',phone,function(error,userData){
				if(!error && userData){
					//Hash the sent password and compare it to the password stored in the user object
					var hashedPassword = helpers.hash(password);

					if(hashedPassword == userData.hashedPassword){
						//If valid create a new token with a random name. Set expiration date 1 hour in the future
						var tokenId = helpers.createRandomString(20);
						var expires = Date.now() + 1000 * 60 * 60 ;
						var tokenObject = {
							'phone' : phone,
							'id' : tokenId,
							'expires' : expires
						};

						//Store the token
						_data.create('tokens',tokenId,tokenObject,function(error){
							if(!error){
								callback(200,tokenObject);
							}else{
								callback(500,{'Error':'Could not create the new token'});
							}
						});

					}else{
						callback(400,{'Error':'Password did not matched the specified users stored password'});
					}

				}else{
					callback(400,{'Error':'Could not find the specified user'});
				}
			})


	}else{
		callback(400,{'Error' : 'Missing required fields'});
	


	}


};

//Tokens - get
//Required data : id
//Optional data : none
handlers._tokens.get = function(data,callback){

	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	if(id){
		//Lookup the token
		_data.read('tokens',id,function(error,tokenData){
			if(!error && tokenData){
				callback(200,tokenData);
			}else{
				callback(404);
			}
		})
	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}

};


//Tokens - put
// Required data : id,extend
// Optional data : none
handlers._tokens.put = function(data,callback){
		var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
		var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? data.payload.extend : false;

		if(id && extend){

			//Lookup the token
			_data.read('tokens',id,function(error,tokenData){
				if(!error && tokenData){
					//Check to make sure the token isn't already expired
					if(tokenData.expires > Date.now()){
						//Set the expiration an hour from now

						tokenData.expires = Date.now() +1000 *60 *60;

						//Store the new updates

						_data.update('tokens',id,tokenData,function(error){
							if(!error){
								callback(200);
							}else{
								callback(500,{'Error' : 'Could not update the token expiration'});
							}
						})
					}else{
						callback(400,{'Error':'The token has already expired and cannot be extended'});
					}

				}else{
					callback(400,{'Error':'Specified token does not exist'});
				}
			});

		}else{
			callback(400,{'Error': 'Missing required fields or fields are invalid'});
		}

};
//Tokens - delete
// Required data : id
//Optional data : none

handlers._tokens.delete = function(data,callback){


	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	if(id){
		//Lookup the user
		_data.read('tokens',id,function(error,data){
			if(!error && data){
				_data.delete('tokens',id,function(error){
					if(!error){
						callback(200);
					}else{
						callback(500,{'Error' : 'Could not delete the specified token'});
					}
				});
			}else{
				callback(400,{'Error' : 'Could not find the specified token'});
			}
		})
	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}

};


//Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function(id,phone,callback){
	//Lookup the token
	_data.read('tokens',id,function(error,tokenData){
		if(!error && tokenData){
			//Check that the token is for the given user and has not expired

			if(tokenData.phone == phone && tokenData.expires>Date.now()){
				callback(true);
			}else{
				callback(false);
			}
		}else{
			callback(false);
		}
	})
}



//==================== CHECKS BEGIN


handlers.checks = function(data,callback){
	var acceptableMethods = ['post','get','put','delete'];
	if(acceptableMethods.indexOf(data.method) > -1 ){
		handlers._checks[data.method](data,callback);
	}else{
		callback(405);
	}

};


// Container for all checks methods

handlers._checks = {};

//Checks post
//Required data : Protocol, url, method successCodes, timeoutSeconds
//Optional data : none

handlers._checks.post = function(data,callback){
	//Validate all the inputs

	var protocol = typeof(data.payload.protocol) == 'string' && ['https','http'].indexOf(data.payload.protocol) > -1  ? data.payload.protocol: false;
	var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
	var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1  ? data.payload.method: false;
	var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
	var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

	if(protocol && url && method && successCodes && timeoutSeconds){
		//Get the token from the headers

		var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

		//Look up the user by reading the token
		_data.read('tokens',token,function(error,tokenData){
			if(!error && tokenData){
				var userPhone = tokenData.phone;

				//Lookup the user data
				_data.read('users',userPhone,function(error,userData){
					if(!error && userData){
						var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
						//Verify that the user has less than the number of max checks allowed
						if(userChecks.length < config.maxChecks){
							//Create a random if for the check

							var checkId = helpers.createRandomString(20);
							//Create the check object and include the users phone
							var checkObject = {
								'id' : checkId,
								'userPhone' : userPhone,
								'protocol' : protocol,
								'url' : url,
								'method' : method,
								'successCodes' : successCodes,
								'timeoutSeconds' : timeoutSeconds
							};


							//Persist the new object to disk
							_data.create('checks',checkId,checkObject,function(error){
								if(!error){
									//Add the check id to the user's object
									userData.checks= userChecks;
									userData.checks.push(checkId);

									//Save the new user data
									_data.update('users',userPhone,userData,function(error){
										if(!error){
											//Return the data about the new check to requester
											callback(200,checkObject);
										}else{
											callback(500,{'Error' : 'Could not update the user with the new check'});
										}
									})	
								}else{
									callback(500,{'Error':'Could not create the new check'});
								}
							})
						}else{
							callback(400,{'Error': 'The user already has the maximun number of checks : '+config.maxChecks});
						}

					}else{
						callback(403);
					}
				})
			}else{
				callback(403);
			}
		});
	

	}else{
		callback(400,{'Error' : 'Missing required inputs or inputs are invalid'});
	}
};


//Checks - get
//Required data : id
//Optional data : none
handlers._checks.get = function(data,callback){
	//Check that the id provided is valid
	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	if(id){


		_data.read('checks',id,function(error,checkData){
			if(!error && checkData){



				//Get the token from the headers
				var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

				//Verify that the given token is valid and belongs to the user who created the check

				handlers._tokens.verifyToken(token,checkData.userPhone,function(tokenIsValid){
					if(tokenIsValid){
						//Return the check data
						callback(200,checkData);

					}else{
						callback(403,{'Error':'Not authorized'});
					}
				});



			}else{
				callback(404,{'Error':'CHeck does not exists'});
			}
		});






	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}
}

//Checks - put
//Required Data : id
//Optional data : protocol, url, method, successCodes, timeoutSeconds
handlers._checks.put = function(data,callback){
	//Check for the required field	
	var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

	//Check for the optional fields
	var protocol = typeof(data.payload.protocol) == 'string' && ['https','http'].indexOf(data.payload.protocol) > -1  ? data.payload.protocol: false;
	var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
	var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1  ? data.payload.method: false;
	var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
	var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;


	if(id){
		//Check to make sure on or mor optional fields has been sent
		if(protocol || url || method || successCodes || timeoutSeconds){
			_data.read('checks',id,function(error,checkData){
				if(!error && checkData){

					//Get the token from the headers
					var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

					//Verify that the given token is valid and belongs to the user who created the check

					handlers._tokens.verifyToken(token,checkData.userPhone,function(tokenIsValid){
						if(tokenIsValid){
							//Update the check where necesary
							if(protocol){
								checkData.protocol = protocol;
							}
							if(url){
								checkData.url = url;
							}
							if(method){
								checkData.method = method;
							}
							if(successCodes){
								checkData.successCodes= successCodes;
							}
							if(timeoutSeconds){
								checkData.timeoutSeconds= timeoutSeconds;
							}

							//Store the updates
							_data.update('checks',id,checkData,function(error){
								if(!error){
									callback(200,{'Success':'Check updated'});
								}else{
									callback(500,{'Error': 'Could not update the chekck'});
								}
							})	

						}else{
							callback(403);
						}
					});


				}else{
					callback(400,{'Error' : 'Check Id did not exist'});
				}
			})

		}else{
			callback(400,{'Error':'Missing fields to update'});
		}

	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}


};

//Checks -- delete
//Required data : id
//Optional data : none
handlers._checks.delete = function(data,callback){

	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	

	//Lookup the check
	_data.read('checks',id,function(error,checkData){
		if(!error && checkData){
				var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

				handlers._tokens.verifyToken(token,checkData.userPhone,function(tokenIsValid){
				if(tokenIsValid){

					//Delete the check data 

					_data.delete('checks',id,function(error){
						if(!error){
							//Lookup the user
							_data.read('users',checkData.userPhone,function(error,userData){
								if(!error && userData){
									var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

									//Remove the deleted check from the their list of checks

									var checkPosition = userChecks.indexOf(id);
									if(checkPosition > -1){
										userChecks.splice(checkPosition,1);
										userData.checks=userChecks;
										_data.update('users',checkData.userPhone,userData,function(error){
											if(!error){
												callback(200);
											}else{
												callback(500,{'Error' : 'Could not update  the  user'});
											}
										});

									}else{
										callback(500,{'Error' : 'Could not find check in user data '});
									}

								}else{
									callback(500,{'Error' : 'Could not find the user who created the check'});
								}
							});

						}else{
							callback(500,{'Error':'Could not delete the check data'});
						}	
					})



				}else{
					callback(403,{'Error' : 'Missing token, operation not allowed'});
				}});

		}else{
			callback(400,{'Error' : 'The specified check id does not exist'})
		}
	});
};

// ========================================= ITEMS LOGIC

handlers.items = function(data,callback){
	var acceptableMethods = ['get'];
	if(acceptableMethods.indexOf(data.method) > -1 ){
		handlers._items[data.method](data,callback);
	}else{
		callback(405);
	}

};



//Container for items
handlers._items = {};

//Items -get
//Required :  phone
handlers._items.get = function(data,callback){

	//Check if user is logged in
	var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
	if(phone){

		//Get the token from the headers
		var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

		//Verify that the given token is valid for the phone number

		handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
			if(tokenIsValid){

				var itemsObject = {
					'1' : {
						'name' : 'Lighter',
						'price' : '10'
					},
					'2' : {
						'name' : 'Cigarrets',
						'price' : '56'
					},
					'3' : {
						'name' : 'Cup of coffee',
						'price' : '15'
					},
				}
				callback(200,itemsObject);

			}else{
				callback(403,{'Error' : 'Missing required token in header or token is invalid'});
			}
		})




	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}

}

//===========================================ITEMS LOGIC END



// ========================================= Shopping cart LOGIC

handlers.shoppingCart = function(data,callback){
	var acceptableMethods = ['post'];
	if(acceptableMethods.indexOf(data.method) > -1 ){
		handlers._shoppingCart[data.method](data,callback);
	}else{
		callback(405);
	}

};



//Container for shoppingCart
handlers._shoppingCart = {};

//shoppingCart -post
//Required :  phone
handlers._shoppingCart.post = function(data,callback){

	//Check if user is logged in
	var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
	var item = typeof(data.payload.item) == 'number' && data.payload.item >0 && data.payload.item<=3 ? data.payload.item : false;
	if(phone && item ){

		//Get the token from the headers
		var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

		//Verify that the given token is valid for the phone number

		handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
			if(tokenIsValid){
				//Lookup the user
				_data.read('users',phone,function(error,userObject){
					if(!error && userObject){
						//Lookup the shopping cart
						_data.read('shoppingcart',userObject.shoppingCartId,function(error,shoppingCart){
							if(!error && shoppingCart){
								//Check if the item already exists, if so, callback error
								var isNewItem = shoppingCart.item == 'number' ? false : true;
								if(isNewItem){
									if(item == 1){
										shoppingCart[item]=10;
									}
									if(item == 2){
										shoppingCart[item]=56;
									}
									if(item == 3 ){
										shoppingCart[item]=15;
									}

									_data.update('shoppingcart',userObject.shoppingCartId,shoppingCart,function(error){
										if(!error){

											callback(200,{'Success':'Item added to shopping cart'});
										}else{
											callback(500,{'Error' : 'Could not add item to cart'});
										}
									});
								}else{
									callback(400,{'Error' : 'Item is already in the shopping cart'});
								}
							}else{
								callback(404,{'Error' : 'Shopping Cart not found'});
							}
						});

					}else{
						callback(500);
					}
				});

			}else{
				callback(403,{'Error' : 'Missing required token in header or token is invalid'});
			}
		})




	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}

}




//===========================================Shopping LOGIC END
// Export the handlers



// ========================================= Orders logic
handlers.orders = function(data,callback){
	var acceptableMethods = ['post'];
	if(acceptableMethods.indexOf(data.method) > -1 ){
		handlers._orders[data.method](data,callback);
	}else{
		callback(405);
	}

};

handlers._orders = {};

handlers._orders.post = function(data,callback){
	//Check that the phone number provided is valid
	var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
	if(phone){

		//Get the token from the headers
		var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

		//Verify that the given token is valid for the phone number

		handlers._tokens.verifyToken(token,phone,function(tokenIsValid){
			if(tokenIsValid){


				_data.read('users',phone,function(error,userData){
					if(!error && userData){
						_data.read('shoppingcart',userData.shoppingCartId,function(error,shoppingCart){
							if(!error && shoppingCart){
								var amount = 0;
								if(typeof(shoppingCart['1']) != 'undefined' ){
									 amount +=10;
								}
								if(typeof(shoppingCart['2']) != 'undefined'){
									 amount +=56;
								}
								if(typeof(shoppingCart['3']) != 'undefined' ){
									 amount +=15;
								}
								console.log('Amount',amount );
								helpers.placeOrderToStripe(amount,function(error){
									if(!error){
										helpers.sendEmail(userData.email,"Payment procced for amount " + amount,function(error){
											if(!error){
												callback(200,{'Message' : 'Order placed and email sent'});
											}else{
												callback(500,error);
											}
										});
									}else{
										callback(500,{'Error' : error});
									}
								});

							}else{
								console.log('Error fetching shoping cart');
								callback(error,false);
							}
						});
					}else{
						callback(error);
					}
				});












			}else{
				callback(403,{'Error' : 'Missing required token in header or token is invalid'});
			}
		})




	}else{
		callback(400,{'Error' : 'Missing required fields'});
	}
}

//=======================================Orders logic end
module.exports = handlers;