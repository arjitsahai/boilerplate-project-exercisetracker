'use-strict';

require('dotenv');

const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
const { Db } = require('mongodb')
mongoose.connect(process.env.MLAB_URI, { useUnifiedTopology: true, useNewUrlParser: true } || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

var exercise = {
  description: String,
  duration: Number,
  date: { type: Date, default: Date.now}
};

var trackerSchema = new mongoose.Schema({
  username: String,
  exercises: [exercise] 
});

var Tracker = mongoose.model("Tracker", trackerSchema);

function throw_promise_error(error){
  return new Promise((resolve, reject)=>{
    reject(error);
  })
}

function saveNewUser(username){
  return new Promise((resolve, reject)=>{
    const user = Tracker({username: username});
    user.save((err, doc)=>{
      if(err) return reject(err);
      return resolve(doc);
    })    
  })
}

function checkUsername(username){
  return new Promise((resolve, reject)=>{
    Tracker.findOne({username: username}, (err, doc)=>{
      if(err) return reject(err);
      else if (doc === null) return ({ status: true});
      else return ({status: false});
    })
  })
}

function saveExercise(userId, exercise){
  return new Promise((resolve, reject)=>{
    if(userId.length!=24){
      reject("unknown");
    } else Tracker.findByIdAndUpdate(
      userId,
      { $push: { exercises: exercise }},
      {new : true},
      (err, doc)=>{
        if(err){
          reject(err.reason.message);
        } else if (doc === null) reject("unknown_id");
        else resolve(doc);
      });
  })
}

function getUserDetails(userId){
  return new Promise((resolve, reject)=>{
    var query = {_id: userId};
    Tracker.findOne(query, (err, doc)=>{
      if(err) reject(err);
      else resolve(doc);
    })
  })
}

function formatOutput(doc, limit, to, from){
  var output = { _id: doc._id, username: doc.username};
  var logs = docs.exercises.slice();
  var filteredLogs =[];
  for (var i in logs){
    var date = new Date(logs[i].date);
    var log = {
      description: logs[i].description,
      duration: logs[i].duration,
      date: logs[i].toDateString()
    };
    if(typeof from !== "undefined"){
      output.from = from;
    } 
    if(typeof to !== "undefined"){
      output.to = to;
    }
    if(
      (typeof to === "undefined" && typeof from === "undefined") ||
      (typeof to !== "undefined" && 
      new Date(to)> date &&
      typeof from == "undefined") ||
      (typeof from !== "undefined" &&
      new Date(from) < date &&
      typeof to === "undefined") ||
      (typeof from !== "unedfined" &&
      new Date(from) < date &&
      typeof to !== "undefined" &&
      new Date(to) > date)
    ){
      filteredLogs.push(log);
    }
    console.log(i);
  }
  console.log(logs);
  if(typeof limit!== "undefined") filteredLogs = filteredLogs.slice(0, limit);
  output.count = filteredLogs.length;
  output.log = filteredLogs;
  return output;
}

app.post('/api/exercise/new-user', (req, res, next) =>{
  const username = req.body.username;
  if(username === null){
    return res.send("Username cannot be empty");
  }  else next();
},
function(req, res){
  const username = req.body.username;
  var promise = checkUsername(username);
  promise.then(function(data){
    if(data.status) return saveNewUser(username);
    else return throw_promise_error("username unavailable");
  })
  .then(function(data){
    return res.json({username: data.username, _id:data._id});
  })
  .catch((err)=>{
    return res.send(err); 
  })
});

app.get('/api/exercise/users', (req, res) =>{
  Db.collection.find()
  .then((data)=>{
  const users = [];
  data.forEach((doc)=>{
    users.push({
      username: doc.data().username,
      _id: doc._id
    })  
  })
  return res.json({users});
})
.catch((err)=>{
  return res.send(err);
})
});

app.post('/api/exercise/add', (req, res, next) =>{
  var params =req.body;
  var notFound = [];
  if(params.userId === ""){
    notFound.push("`userId`");
  }
  if(params.description === ""){
    notFound.push("`description`");
  }
  if(params.duration === ""){
    notFound.push("`duration`");
  }
  if(params.date === ""){
    req.body.date = new Date();
  }

  if(notFound.length > 0) return res.send(notFound.toString() + "required!");
  else next();
},
(req, res)=> {
  var exercise = {
    description : req.body.description,
    duration: req.body.duration,
    date: req.body.date
  };
  var promise = saveExercise(req.body.userId, exercise);
  promise.then((data)=>{
    return res.json(
      Object.assign({ username: data.username, _id: data._id}, exercise)
    );  
  })
  .catch((err)=>{
    return res.json(err);
  })
});

app.get('/api/exercise/log', (req, res) =>{
  var promise = getUserDetails(req.query.userId);
  promise.then((data)=>{
    return res.json(
      formatOutput(
        data,
        req.query.limit,
        req.query.to,
        req.query.from
      )
    );
  })
  .catch((err)=>{
    return res.json(err);
  })
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
