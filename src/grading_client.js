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
    }
});

function onConnect() {
   connection.createChannel(function (err, ch) {
       var queue = 'grading_queue';
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

           messages_to_grade.push({
               meta_data: meta_data,
               content: content
           });
       });
   });
}

function gradeMessage(req_id) {
    messages_to_grade.forEach(function (x) {
        if(x.content.req_id === req_id) {
            var message = x;
            connection.createChannel(function (err, ch) {
                ch.assertQueue('', {exclusive:false}, function (err, q) {
                    var response = {
                        graded: true,
                        req_id: message.content.req_id
                    };

                    var jsonResponse = JSON.stringify(response);

                    ch.sendToQueue(message.meta_data.reply_queue,
                        new Buffer(jsonResponse),
                        {correlationId: message.meta_data.req_id});
                })
            })
        }
    })
}

app.use(bodyParser.json());

app.get('/', function (req, res) {
    res.end("Hello world from Grading Client")
});

app.post('/grade', function (req, res) {
    var body = req.body;
    console.log("Grade received: " + JSON.stringify(body));

    var grade = body.grade;
    var req_id = body.reqId;

    gradeMessage(req_id);

    res.end("Grade successful");
});

var server = app.listen(8081, function () {
    var port = server.address().port;
    console.log("Grading Client listening at port %s", port);
});