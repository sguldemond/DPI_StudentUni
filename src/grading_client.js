#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function (err, conn) {
   conn.createChannel(function (err, ch) {
        var queue = 'gd_queue';
        ch.assertQueue(queue, {durable:false});
        console.log('[*] Grading Client is waiting for messages on %s ...', queue);

       ch.consume(queue, function (msg) {
           console.log('[x] Received message');

           var content = JSON.parse(msg.content.toString());


       })
   })
});