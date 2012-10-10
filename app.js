//app.js Socket IO Test
var io = require('socket.io'),
    cluster = require('cluster');

var MAX_NODES = 4;
var ROOM = "";
var workers = [];

if (cluster.isMaster) {
  for (var i = 0; i < MAX_NODES; i++) {
    workers.push(cluster.fork().id);
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
  });
  console.log('master ', process.pid);

  /*setTimeout(function() {
    //var lastId = workers[workers.length-1];
    for(var i=1; i<workers.length; i++) {
      var lastId = workers[i];
      console.log('destroying worker ' + lastId);
      cluster.workers[lastId].destroy();
    }
  }, 30*1000);
*/
} else {
  console.log('Server at http://127.0.0.1:8000/ (pid: %d)', process.pid);
  var app = require('http').createServer(httpHandler),
      io = io.listen(app),
      fs = require('fs');

  io.configure( function(){
    io.set('log level', 2);
    io.set('transports', ['xhr-polling']);
    var RedisStore = require('socket.io/lib/stores/redis');
    io.set('store', new RedisStore()); /* constructor will create 3 redis connections itself */
  });

  app.listen(8000);
  
  function httpHandler(req, res) {
    fs.readFile('index.html',
      function (err, data) {
        res.writeHead(200);
        res.end(data);
      });
  };

  io.sockets.on('connection', function(client){
    console.log('accepting connection on server ' + process.pid);

    client.on("join", function(user, fn){
      console.log('joining on server ' + process.pid);

      client.set('user', user);
      client.join(ROOM);
      client.broadcast.to(ROOM).send("New user joined room [" + ROOM + "]: " + user);

      fn("Hello " + user);

      console.log('joined');
    });

    client.on('message', function(msg, fn){
        console.log('received message by ' + process.pid);

        client.get('user', function(err,user) {
          if(err) console.log(err);

          if(msg == 'kill') {
            console.log("killing pid=" + process.pid);
            throw new Error("i'm dead");
          }

          msg = user + ": " + msg;
          client.broadcast.to(ROOM).send(msg);
          fn(msg);
        });
    });

    client.on('disconnect', function(){
      client.get('user', function(err, user) {
        if(err) console.log(err);

        console.log('disconnecting user ' + user);
        client.broadcast.to(ROOM).send("User disconnected: " + user);
      });
    });
      
  });

  function pingClients() {
    console.log("sending ping from " + process.pid);
    io.sockets.send('system: PING');
    setTimeout(pingClients, 30*1000);
  };

//  pingClients();
}