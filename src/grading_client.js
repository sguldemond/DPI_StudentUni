#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var uuid = require('uuid/v4');
var express = require('express');
var bodyParser = require('body-parser');

var connection;
var messages_to_grade = [];
var app = express();

amqp.connect('amqp://localhost', function (err, conn) {
    if(err != undefined) {
        console.error(err);
    } else {
        connection = conn;
        onConnect();
        // gradeMessage(messages_to_grade[0]);
    }
});

function onConnect() {
   connection.createChannel(function (err, ch) {
       var queue = 'gd_queue';
       ch.assertQueue(queue, {durable:false});
       console.log('[*] Grading Client is waiting for messages on %s ...', queue);

       ch.consume(queue, function (msg) {
           console.log('[x] Received message');

           var content = JSON.parse(msg.content.toString());
           console.log(content);

           var meta_data = {
               reply_queue: msg.properties.replyTo,
               req_id: msg.properties.correlationId
           };

           var corr_id = uuid();
           console.log("Message made with corrId: " + corr_id);

           messages_to_grade.push({
               corr_id: corr_id,
               meta_data: meta_data,
               content: content
           });
       });
   });
}

function gradeMessage(corr_id) {
    connection.createChannel(function (err, ch) {
        console.log("Error: " + err);
        ch.assertQueue('', {exclusive:false}, function (err, q) {
            messages_to_grade.forEach(function (x) {
                if(x.corr_id === corr_id) {
                    var message = x;

                    var response = {
                        graded: true,
                        req_id: message.content.req_id
                    };

                    var jsonResponse = JSON.stringify(response);

                    ch.sendToQueue(message.meta_data.replyTo,
                        new Buffer(jsonResponse),
                        {correlationId: message.meta_data.correlationId});
                }
            });
        });
    });
}

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.end("Hello world from Grading Client")
});

app.post('/grade', function (req, res) {
    var body = req.body;
    console.log("Grade received: " + JSON.stringify(body));

    var grade = body.grade;
    var corr_id = body.corrId;

    gradeMessage(corr_id);

    res.end("Grade successful");
});

var server = app.listen(8081, function () {
    var port = server.address().port;
    console.log("Grading Client listening at port %s", port);
});