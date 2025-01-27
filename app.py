import os
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from PyPDF2 import PdfReader
from langchain.text_splitter import CharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain
import openai
import speech_recognition as sr
import io
import base64
from pdf2image import convert_from_path
from PIL import Image

app = Flask(__name__)
conversation_chain = None
chat_history = []


def get_pdf_text(pdf_docs):
    text = ""
    for pdf in pdf_docs:
        pdf_reader = PdfReader(pdf)
        for page in pdf_reader.pages:
            text += page.extract_text()
    return text


def get_text_chunks(text):
    text_splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=1500,
        chunk_overlap=300,
        length_function=len
    )
    return text_splitter.split_text(text)


def get_vectorstore(text_chunks, key):
    embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
    embeddings.openai_api_key = key
    vectorstore = FAISS.from_texts(texts=text_chunks, embedding=embeddings)
    vectorstore.index.nprobe = 10
    return vectorstore


def get_conversation_chain(vectorstore):
    llm = ChatOpenAI(model_name="gpt-3.5-turbo")
    memory = ConversationBufferMemory(memory_key='chat_history', return_messages=True)
    return ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=vectorstore.as_retriever(),
        memory=memory
    )


def get_general_knowledge_response(question):
    openai.api_key = os.getenv('OPENAI_API_KEY')
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "Provide a general workaround or alternative solution for the following query:"},
            {"role": "user", "content": question}
        ],
        max_tokens=150
    )
    answer = response.choices[0].message['content'].strip()
    return {"question": question, "answer": answer}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/process_pdfs', methods=['POST'])
def process_pdfs():
    global conversation_chain, chat_history
    chat_history = []

    pdf_files = request.files.getlist('pdfs')
    raw_text = get_pdf_text(pdf_files)
    text_chunks = get_text_chunks(raw_text)

    load_dotenv()
    api_key = os.getenv('OPENAI_API_KEY')
    vectorstore = get_vectorstore(text_chunks, api_key)
    conversation_chain = get_conversation_chain(vectorstore)

    return jsonify({'message': 'PDFs processed successfully.'})


@app.route('/ask_question', methods=['POST'])
def ask_question():
    global conversation_chain, chat_history

    if not conversation_chain:
        return jsonify({"error": "No PDF files processed yet."})

    data = request.get_json()
    question = data.get('question', '').strip()

    if not question:
        return jsonify({"error": "Question is empty."})

    # Check for workaround-related terms
    workaround_terms = ['workaround', 'other way', 'alternative', 'solution']
    is_workaround_question = any(term in question.lower() for term in workaround_terms)

    # Append user question to chat history
    chat_history.append({"sender": "user", "message": question})

    if is_workaround_question:
        # Get the response from general knowledge
        general_answer = get_general_knowledge_response(question)

        # Append the bot answer to chat history
        chat_history.append({"sender": "bot", "message": general_answer})

        # Return the chat history
        return jsonify(chat_history)

    else:
        # Get the response based on the document
        response = conversation_chain({'question': question})
        answer = response['answer']
        document_chat_history = response['chat_history']

        # Append the bot answer to chat history
        chat_history.append({"sender": "bot", "message": answer})

        # Return the chat history
        return jsonify(chat_history)


if __name__ == '__main__':
    app.run(debug=True, port=8080)
