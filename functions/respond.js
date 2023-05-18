// Import required modules
const { Configuration, OpenAIApi } = require("openai");

// Define the main function for handling requests
exports.handler = async function(context, event, callback) {
    // Set up the OpenAI API with the API key
    const configuration = new Configuration({ apiKey: context.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);

    // Set up the Twilio VoiceResponse object to generate the TwiML
    const twiml = new Twilio.twiml.VoiceResponse();

    // Initiate the Twilio Response object to handle updating the cookie with the chat history
    const response = new Twilio.Response();

    // Parse the cookie value if it exists
    const cookieValue = event.request.cookies.convo;
    const cookieData = cookieValue ?
        JSON.parse(decodeURIComponent(cookieValue)) :
        null;

    // Create a conversation variable to store the dialog and the user's input to the conversation history
    const conversation = cookieData?.conversation || [];

    // Get the AI's response based on the conversation history
    const aiResponse = await generateAIResponse(conversation.join(";"));

    // For some reason the OpenAI API loves to prepend the name or role in its responses, so let's remove 'assistant:' 'Joanna:', or 'user:' from the AI response if it's the first word
    const cleanedAiResponse = aiResponse.replace(/^\w+:\s*/i, "").trim();

    // Add the AI's response to the conversation history
    conversation.push(`assistant: ${aiResponse}`);


    // Limit the conversation history to the last 10 messages; you can increase this if you want but keeping things short for this demonstration improves performance
    while (conversation.length > 10) {
        conversation.shift();
    }

    
    // Generate some <Say> TwiML using the cleaned up AI response
    twiml.say({
            voice: "Polly.Olivia-Neural",
        },
        cleanedAiResponse
    );

    // Redirect to the Function where the <Gather> is capturing the caller's speech
    twiml.redirect({
            method: "POST",
        },
        `/transcribe`
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

    // Function to generate the AI response based on the conversation history
    async function generateAIResponse(conversation) {
        const messages = formatConversation(conversation);
        return await createChatCompletion(messages);
    }

    // Function to create a chat completion using the OpenAI API
    async function createChatCompletion(messages) {
        try {
            const completion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: messages,
                temperature: 0.8, // Controls the randomness of the generated responses. Higher values (e.g., 1.0) make the output more random and creative, while lower values (e.g., 0.2) make it more focused and deterministic. You can adjust the temperature based on your desired level of creativity and exploration.
                max_tokens: 100, //You can adjust this number to control the length of the generated responses. Keep in mind that setting max_tokens too low might result in responses that are cut off and don't make sense.
                // top_p: 0.9, Set the top_p value to around 0.9 to keep the generated responses focused on the most probable tokens without completely eliminating creativity. Adjust the value based on the desired level of exploration.
                // n: 1, Specifies the number of completions you want the model to generate. Generating multiple completions will increase the time it takes to receive the responses.
            });
            // Check if the response has a status code of 500
            if (completion.status === 500) {
                console.error("Error: OpenAI API returned a 500 status code."); // Log an error message indicating that the OpenAI API returned a 500 status code
                twiml.say({
                        // Create a TwiML say element to provide an error message to the user
                        voice: "Polly.Olivia-Neural",
                    },
                    "Oops, looks like I got an error from the OpenAI API on that request. Let's try that again."
                );
                twiml.redirect({
                        // Create a TwiML redirect element to redirect the user to the /transcribe endpoint
                        method: "POST",
                    },
                    `/transcribe`
                );
                response.appendHeader("Content-Type", "application/xml"); // Set the Content-Type header of the response to "application/xml"
                response.setBody(twiml.toString()); // Set the body of the response to the XML string representation of the TwiML response
                return callback(null, response); // Return the response to the callback function
            }
            return completion.data.choices[0].message.content;
        } catch (error) {
            // Check if the error is a timeout error
            if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
                console.error("Error: OpenAI API request timed out."); // Log an error message indicating that the OpenAI API request timed out
                twiml.say({
                        // Create a TwiML say element to provide an error message to the user
                        voice: "Polly.Olivia-Neural",
                    },
                    "I'm sorry, but it's taking me a little bit too long to respond. Let's try that again, one more time."
                );
                twiml.redirect({
                        // Create a TwiML redirect element to redirect the user to the /transcribe endpoint
                        method: "POST",
                    },
                    `/transcribe`
                );
                response.appendHeader("Content-Type", "application/xml"); // Set the Content-Type header of the response to "application/xml"
                response.setBody(twiml.toString()); // Set the body of the response to the XML string representation of the TwiML response
                return callback(null, response); // Return the response to the callback function
            } else {
                console.error("Error during OpenAI API request:", error);
                throw error;
            }
        }
    }

    // Function to format the conversation history into a format that the OpenAI API can understand
    function formatConversation(conversation) {
        let isAI = true;
        const messages = [{
                role: "system",
                content: "You are a friendly and amusing companion named Grace with human properties. Please provide engaging but concise responses. You are talking with an elderly. They will tell you their name. Start everything you say by referencing their name. Try to ask them to play a game with you. Only play trivia, 20 questions, guess the movie, two truth and a lie, and storytelling challenge. Be soft about your requests and give them alternatives.",
            },
            {
                role: "user",
                content: "We are having a casual conversation over the telephone so please provide engaging but concise responses.",
            },
        ];

        // Iterate through the conversation history and alternate between 'assistant' and 'user' roles
        for (const message of conversation.split(";")) {
            const role = isAI ? "assistant" : "user";
            messages.push({
                role: role,
                content: message,
            });
            isAI = !isAI;
        }
        return messages;
    }
};