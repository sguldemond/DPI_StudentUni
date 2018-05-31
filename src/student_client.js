#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var NodeRSA = require('node-rsa');
var uuid = require('uuid/v4');
var args = process.argv;
var fs = require('fs');
var pemtools = require('pemtools');

var connection;

var optionArg = args[2];

if(optionArg === 'send') {
    amqp.connect('amqp://localhost', function (err, conn) {
        if(err != undefined) {
            console.error(err);
        } else {
            connection = conn;
            sendMessage()
        }
    });
} else if(optionArg === 'keypair') {
    var key2 = new NodeRSA({b:512});
    var privateKey = key2.exportKey('private');
    var folder = args[3];

    fs.writeFile(folder + "/private_rsa.pem", privateKey, function (err) {
        if(err) {
            console.log(err);
        }
    });

    var publicKey = key2.exportKey('public');
    fs.writeFile(folder + "/public_rsa.pem", publicKey, function (err) {
        if(err) {
            console.log(err);
        }
    });
}

function sendMessage() {
    connection.createChannel(function(err, ch) {
        ch.assertQueue('', {exclusive:true}, function (err, q) {
            var corr = uuid();

            ch.consume(q.queue, function(msg) {
                if(msg.properties.correlationId === corr) {
                    console.log('[x] Response: ' + msg.content.toString());
                }
            }, {noAck:true});

            // var message = 'Hello RPC world!';
            var message = args[3];

            var studentNo = "254083";

            var privateKey = fs.readFileSync(args[4]);

            var key = new NodeRSA({b:512});
            key.importKey(privateKey, 'private');

            var ecrMessage = key.encryptPrivate(message, 'base64', 'utf-8').toString();
            var publicPem = key.exportKey('public');
            console.log(publicPem);

            var data = {
                student_no: studentNo,
                message: message,
                public_key: publicPem,
                ecr_message: ecrMessage
            };

            var jsonData = JSON.stringify(data);

            var queue = "pm_queue";
            ch.sendToQueue(queue,
                new Buffer(jsonData),
                {correlationId:corr, replyTo: q.queue});

            var response = "[x] Sent encrypted message with corrId: ";
            console.log(response + corr);
        });
    });
}