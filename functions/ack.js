// Define the main function for handling requests
exports.handler = async function(context, event, callback) {

    // Set up the Twilio VoiceResponse object to generate the TwiML
    const twiml = new Twilio.twiml.VoiceResponse();

    // Initiate the Twilio Response object to handle updating the cookie with the chat history
    const response = new Twilio.Response();

    // Parse the cookie value if it exists
    const cookieValue = event.request.cookies.convo;
    const cookieData = cookieValue ?
        JSON.parse(decodeURIComponent(cookieValue)) :
        null;

    // Get the user's voice input from the event
    let voiceInput = event.SpeechResult;

    // Create a conversation variable to store the dialog and the user's input to the conversation history
    const conversation = cookieData?.conversation || [];
    conversation.push(`user: ${voiceInput}`);


    // Limit the conversation history to the last 10 messages; you can increase this if you want but keeping things short for this demonstration improves performance
    while (conversation.length > 10) {
        conversation.shift();
    }

    
    // Generate some <Say> TwiML using the cleaned up AI response
    twiml.say({
            voice: "Polly.Olivia-Neural",
        },
        "Okay"
    );

    // Redirect to the Function where the <Gather> is capturing the caller's speech
    twiml.redirect({
            method: "POST",
        },
        `/respond`
    );

    // Since we're using the response object to handle cookies we can't just pass the TwiML straight back to the callback, we need to set the appropriate header and return the TwiML in the body of the response
    response.appendHeader("Content-Type", "application/xml");
    response.setBody(twiml.toString());

    // Update the conversation history cookie with the response from the OpenAI API
    const newCookieValue = encodeURIComponent(
        JSON.stringify({
            conversation,
        })
    );
    response.setCookie("convo", newCookieValue, ["Path=/"]);

    // Return the response to the handler
    return callback(null, response);

};