
let globalQuestionsList = []; // Array to store questions and their chat histories

const recordButton = document.getElementById('record-button');
const recordingStatus = document.getElementById('recording-status');
const fileInput = document.getElementById('file-input');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
let mediaRecorder;
let audioChunks = [];

        function updateButtonState() {
            const hasFiles = fileInput.files.length > 0;
            userInput.disabled = !hasFiles;
            sendButton.disabled = !hasFiles;
            recordButton.disabled = !hasFiles;

        }
        updateButtonState();
        document.getElementById('file-input').addEventListener('change', function() {
            const uploadedFileName = document.getElementById('uploaded-file-name');
            const fileNames = [];

            for (const file of fileInput.files) {
                fileNames.push(file.name);
            }
            uploadedFileName.textContent = `Selected files: ${fileNames.join(', ')}`;
            updateButtonState();
        });

        document.getElementById('upload-button').addEventListener('click', async function() {
            const formData = new FormData();
            const pdfs = document.getElementById('file-input').files;
            const uploadedFileName = document.getElementById('uploaded-file-name');
            const fileNames = [];

            for (const pdf of pdfs) {
                formData.append('pdfs', pdf);
                fileNames.push(pdf.name);
            }
            uploadedFileName.textContent = `Uploaded files: ${fileNames.join(', ')}`;
            const response = await fetch('/process_pdfs', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            alert(result.message);
            updateButtonState();
        });

        document.getElementById('send-button').addEventListener('click', async function() {
            const userInput = document.getElementById('user-input').value.trim();
            if (!userInput) return;

            const response = await fetch('/ask_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: userInput })
            });
            const chatHistory = await response.json();
            console.log(chatHistory);
            // Add the question and its chat history to globalQuestionsList
            globalQuestionsList.push({ question: userInput, chatHistory });

            // Clear chat box and render questions with answers
            updateChatBox();

            document.getElementById('user-input').value = '';
        });


    let isRecording = false;
    document.getElementById('record-button').addEventListener('click', function() {
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        if (isRecording){
            recognition.stop();
            isRecording = false;
            document.getElementById('record-button').textContent = 'Record';
            document.getElementById('record-button').classList.remove('recording');
        }
        else{
            recognition.start();
            isRecording = true;
            document.getElementById('record-button').classList.add('recording');
        }

        recognition.onstart = function() {
            if(window.innerWidth > 600){
                document.getElementById('record-button').textContent = 'Recording...';
            }
        };

        recognition.onresult = async function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('user-input').value = transcript;
            if(window.innerWidth > 600){
                document.getElementById('record-button').textContent = 'Record';
            }
            const userInput = transcript.trim();
            if (!userInput) return;

            const response = await fetch('/ask_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: userInput })
            });
            const chatHistory = await response.json();

            globalQuestionsList.push({ question: userInput, chatHistory });

            updateChatBox();
        };

        recognition.onerror = function(event) {
            console.error(event.error);
            if(window.innerWidth > 600){
            document.getElementById('record-button').textContent = 'Record';
            }
        };

        recognition.onend = function() {
            if(window.innerWidth > 600){
                document.getElementById('record-button').textContent = 'Record';
                }
                document.getElementById('record-button').classList.remove('recording');
            setTimeout(function() {
                document.getElementById('user-input').value = '';
            }, 2000);
        };
    } else {
        alert('Speech recognition not supported in this browser. Please use Google Chrome.');
    }
    });

function updateChatBox() {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = '';

    // Display chat history for the latest question only
    const latestQuestionItem = globalQuestionsList[globalQuestionsList.length - 1];
    latestQuestionItem.chatHistory.forEach(item => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(item.sender.toLowerCase() === 'user' ? 'user-message' : 'bot-message');
        if (item.message.startsWith('http') && (item.message.endsWith('.jpg') || item.message.endsWith('.png') || item.message.endsWith('.gif'))) {
            // If the message is an image URL, create an image element
            messageDiv.innerHTML = `<img src="${item.message}" alt="Image" class="chat-image">`;
        } else {
            // Check for structured data (steps, lists)
            if (item.message.includes('**') || item.message.includes('1.')) {
                const formattedMessage = formatStructuredMessage(item.message);
                messageDiv.innerHTML = `<div class="message">${formattedMessage}</div>`;
            } else {
                // Otherwise, treat it as a text message
                messageDiv.innerHTML = `<div class="message">${item.message}</div>`;
            }
        }

        chatBox.appendChild(messageDiv);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
}
function formatStructuredMessage(message) {
    // Replace **text** with <strong>text</strong>
    let formattedMessage = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Replace 1. Step with <ol><li>Step</li></ol>
    formattedMessage = formattedMessage.replace(/(\d+)\.\s+/g, (match, p1) => {
        return `<ol start="${p1}"><li>`;
    });

    // Close the <li> and <ol> tags properly
    formattedMessage = formattedMessage.replace(/<li>(.*?)<\/ol>/g, '<li>$1</li></ol>');
    formattedMessage = formattedMessage.replace(/<\/li>\s+(\d+)\.\s+/g, '</li><li>');

    return formattedMessage;
}
    updateButtonState();
