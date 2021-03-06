// BASE SETUP
// ======================================

// CALL THE PACKAGES --------------------
var express    = require('express');		// call express
var app        = express(); 				// define our app using express
var bodyParser = require('body-parser'); 	// get body-parser
var morgan     = require('morgan'); 		// used to see requests
var jwt 	   = require('jsonwebtoken');	// used for auth tokens
var mongoose   = require('mongoose');
var User       = require('./app/models/user');
var port       = process.env.PORT || 8080; // set the port for our app
var User 	   = require('./app/models/user'); //get User schema
var secret 	   = 'superSecretPasswordsecretThing'; //used in creation of JWT tokens


// APP CONFIGURATION ---------------------
// use body parser so we can grab information from POST requests
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// configure our app to handle CORS requests
app.use(function(req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');
	next();
});


// log all requests to the console 
app.use(morgan('dev'));

//connect to our database
mongoose.connect('mongodb://localhost:27017/nodeAPI');

// ROUTES FOR OUR API
// ======================================

// basic route for the home page
app.get('/', function(req, res) {
	res.send('Welcome to the home page!');
});

// get an instance of the express router
var apiRouter = express.Router();

// route for authenticating users
// REM: BEFORE auth middleware! This way unauth users can get here
apiRouter.post('/authenticate', function(req, res) {
	
	//Find User By ID
	User.findOne({
		username: req.body.username
		}).select('name username password').exec(function(err, user){
			
			if (err) res.send("ERROR: " + err);
			
			var authMessage = "Authentication Failed: ";
			
			//No user with that username found
			if (!user) {
				res.json({
					success: false,
					message: authMessage + "User Not Found"
				});
			} else if (user) {  //user found
				
				//check if request PW matches using Model static method!
				var validPW = user.comparePassword(req.body.password); 
				
				//if doesn't match
				if (!validPW) {
					res.send({
						success: false,
						message: authMessage + "Wrong Password"
					});
				} else { //valid password entered
					
					//Create JWT Token
					//ARGS -> pass object with name, username
					// secret, expiration in minutes
					var token = jwt.sign({
							name: user.name,
							username: user.username
						}, secret, {expiresInMinutes: 1440}); //expire in 24 hours
					
					res.json({
						success: true,
						message: 'Enjoy your token!',
						token: token
					}); //Return token for future requests
					
				}
				
				
			}
			
		})
	
	
});

//All API Middleware
//Verify req's JWT token
apiRouter.use(function(req, res, next) {
	console.log("New request to API");
	
	//retrieve token from body, arg, or header
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	
	//if passed, verify it
	if (token) {
		
		//use jwt library to decode (need token and secret to decode)
		jwt.verify(token, secret, function(err, decoded) {
			
			if (err) {
				res.status(403).send({
					success: false,
					message: "Failed to authenticate token."
				});
			} else { //token valid
			
				req.decoded = decoded; //save the token back to request for future use
				next(); //allow through to route
				
			}
		}); //end verify
		
		
	} else { //no token provided
		return res.status(403).send({
			success: false,
			message: "No token provided."
		});	
	}
	
	//next(); //allow to proceed with request
});

// test route to make sure everything is working 
// accessed at GET http://localhost:8080/api
apiRouter.get('/', function(req, res) {
	res.json({ message: 'hooray! welcome to our api!' });	
});

//api endpoint to get logged-in user information
apiRouter.get('/me', function(req, res) {
	res.send(req.decoded); //return the decoded json token
});

//create route then apply new methods!
apiRouter.route('/users')

	.post(function(req, res) {
		//create new user
		var user = new User();
		
		//set user info that came in req
		user.name = req.body.name;
		user.username = req.body.username;
		user.password = req.body.password;
		
		user.save(function(err) { //use built in save to send user to MDB
			
			if (err) { //if error, handle appropriately
				if (err.code == 11000) { //tried to create duplicate entry
					return res.json({ success: false, message: 'A user with that username already exists. '});
				}
				else {
					return res.send(err);
				}
			
			}
			//no error, user created
			res.json({message: 'User Created!'});
			
		});
		
	}) //end POST
	
	.get(function(req, res) {
		//REM: mongoose model is collection object! 
		//you can run queries just using model name
		
		//find takes callback -> takes err object or list of 
		//docs returned from query
		User.find(function(err, users) {
			if (err) {
				res.send("ERROR: " + err);
			} else {
				res.json(users);
			}
		})
		
	});
	
//Sample middleware for all routes with /:user_id
apiRouter.param('user_id',function(req, res, next) {
	console.log("API Request For Particular User: " + req.params.user_id);
	
	//if id sent in request, proceed
	if (typeof req.params.user_id !== "undefined") {
		next();
	} else { //otherwise, alert in response
		res.json({
			status: false,
			message: "No Id Passed In Request"});
	}
	
	
})

apiRouter.route('/users/:user_id')

	//GET user with the id given
	.get(function(req, res) {
		
		//REM: mongoose model is collection object!
		//retrieve user by the user_id param in request object!
		User.findById(req.params.user_id, function(err, user) {
			
			if (err) {
				res.send("ERROR: " + err);
			} else {
				res.json(user);
			}
			
		});
		
	}) //end GET
	
	//PUT (update) user with id given
	.put(function(req, res) {
		//get the user object id 
		User.findById(req.params.user_id, function(err, user) {
			if (err) res.send("ERROR: " + err);
			
			//update users info ONLY if new (if sent in request body)
			if(req.body.name) {user.name = req.body.name;}
			if(req.body.username) {user.username = req.body.username;}
			if(req.body.password) {user.password = req.body.password;}
			
			//save the user object 
			user.save (function(err) {
				if (err) res.send("ERROR: " + err);
				
				res.json({message: "User Updated"});
			});
			
			
			
		});
	})
	
	//DELETE user with given id
	.delete(function(req, res) {
		//REM: pass in json object for query -> match _id to req id
		User.remove({_id : req.params.user_id}, function(err, user) {
			if (err) res.send("ERROR: " + err);
			
			res.json({message: "User Deleted!"});
			
		})
	});
	


// REGISTER OUR ROUTES -------------------------------
app.use('/api', apiRouter);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);