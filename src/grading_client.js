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

           console.log(content);

           // var stdin = process.openStdin();

           var response = {
               graded: true,
               req_id: content.req_id
           };

           // stdin.addListener("data", function(grade) {
           //     var grade = grade.toString().trim()
           //     response = {
           //         graded: grade,
           //         req_id: content.req_id
           //     };
           //
           //     console.log("You graded: [ " + grade + " ]");
           // });

           var jsonResponse = JSON.stringify(response);

           ch.sendToQueue(msg.properties.replyTo,
               new Buffer(jsonResponse),
               {correlationId: msg.properties.correlationId});
           ch.ack(msg);
       });
   })
});