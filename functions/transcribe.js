exports.handler = function(context, event, callback) {
    // Create a TwiML Voice Response object to build the response
    const twiml = new Twilio.twiml.VoiceResponse();

    // If no previous conversation is present, or if the conversation is empty, start the conversation
    if (!event.request.cookies.convo) {
        // Greet the user with a message using AWS Polly Neural voice
        twiml.say({
                voice: 'Polly.Olivia-Neural',
            },
            "Hey there! I'm Grace, your friendly companion. We can talk, play a game, or explore other ways I can help you. What is your name?"
        );
    }


    // Listen to the user's speech and pass the input to the /ack Function
    twiml.gather({
        speechTimeout: 'auto', // Automatically determine the end of user speech
        speechModel: 'experimental_conversations', // Use the conversation-based speech recognition model
        input: 'speech', // Specify speech as the input type
        action: '/ack', // Send the collected input to /ack
    });

    twiml.say({
    voice: "Polly.Olivia-Neural",
    },"Are you still there?");

    twiml.pause({ length: 5 });

    twiml.gather({
        speechTimeout: 'auto', // Set the timeout to 5 seconds (adjust as needed)
        speechModel: 'experimental_conversations', // Use the conversation-based speech recognition model
        input: 'speech', // Specify speech as the input type
        action: '/ack', // Send the collected input to /ack
      });

    // Create a Twilio Response object
    const response = new Twilio.Response();

    // Set the response content type to XML (TwiML)
    response.appendHeader('Content-Type', 'application/xml');

    // Set the response body to the generated TwiML
    response.setBody(twiml.toString());

    // If no conversation cookie is present, set an empty conversation cookie
    if (!event.request.cookies.convo) {
        response.setCookie('convo', '', ['Path=/']);
    }

    // Return the response to Twilio
    return callback(null, response);
};