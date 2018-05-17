#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var NodeRSA = require('node-rsa');
var key = new NodeRSA();

amqp.connect('amqp://localhost', function (err, conn) {
    conn.createChannel(function (err, ch) {
        var queue = 'hv_queue';

        ch.assertQueue(queue, {durable:false});

        console.log('[*] Hash Validator is waiting for messages on %s ...', queue);

        ch.consume(queue, function (msg) {
            console.log('[x] Received message');

            var content = JSON.parse(msg.content.toString());

            console.log(content.public_key);

            key.importKey(content.public_key, 'public');

            var response;
            try {
                var decryptedMessage = key.decryptPublic(content.ecr_message, 'utf8');
                console.log('Message: ' + decryptedMessage);
                response = {message:'Validation successful'};
            }
            catch (err) {
                response = {message:'Validation unsuccessful', error:err.message}
            }
            var jsonResponse = JSON.stringify(response);

            ch.sendToQueue(msg.properties.replyTo,
                new Buffer(jsonResponse),
                {correlationId: msg.properties.correlationId});
            ch.ack(msg);
        })
    })
})