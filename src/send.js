#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var NodeRSA = require('node-rsa');
var key = new NodeRSA({b:512});

amqp.connect('amqp://localhost', function(err, conn) {
    conn.createChannel(function(err, ch) {
        var q = 'hello_queue';
        var text = "Hello world!";

        // key.generateKeyPair();

        var encryptedMessage = key.encryptPrivate(text, 'base64', 'utf-8');

        var privatePem = key.exportKey('private');
        console.log(privatePem);

        var publicPem = key.exportKey('public');
        console.log(publicPem);

        var data = {public_key: publicPem, message: encryptedMessage};
        var json = JSON.stringify(data);

        ch.assertQueue(q, {durable: false});
        ch.sendToQueue(q, new Buffer(json));

        console.log('[x] Sent encrypted message: ' + json);
    });
});