// ==========================================
// CONFIGURATION
// ==========================================
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRnhDcUEhGc5sh5NaCd0GTE6C9ceWyN-Zbvy8R27FOqkG6oODceGv4Wm3MZrAEzNWc2Jir9YclcPFAY/pub?gid=0&single=true&output=csv"; 

let masterDatabase = [];
let currentQuizData = [];
let userAnswers = {}; 
let currentQuestionIndex = 0;
let timerInterval;
let timeLeftRemaining = 0;

window.onload = () => {
    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            masterDatabase = results.data;
            console.log("Database Loaded successfully.");
            showView('home'); 
        },
        error: function(err) {
            document.getElementById('loading').innerHTML = "<h2>Error loading database.</h2>";
        }
    });
};

function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    clearInterval(timerInterval); 
}

function startDaily5() {
    let organic = masterDatabase.filter(q => q.Category === "Organic");
    let physical = masterDatabase.filter(q => q.Category === "Physical");
    let inorganic = masterDatabase.filter(q => q.Category === "Inorganic");
    let aptitude = masterDatabase.filter(q => q.Category === "Aptitude");

    currentQuizData = [
        organic[Math.floor(Math.random() * organic.length)] || masterDatabase[0],   
        physical[Math.floor(Math.random() * physical.length)] || masterDatabase[1],  
        inorganic[Math.floor(Math.random() * inorganic.length)] || masterDatabase[2],
        aptitude[Math.floor(Math.random() * aptitude.length)] || masterDatabase[3],
        masterDatabase[Math.floor(Math.random() * masterDatabase.length)] 
    ].filter(Boolean);

    startQuizEngine(300); 
}

function startCustomPractice() {
    let category = document.getElementById('category-filter').value;
    if (category === "All") {
        currentQuizData = [...masterDatabase].sort(() => 0.5 - Math.random()).slice(0, 10);
    } else {
        currentQuizData = masterDatabase.filter(q => q.Category === category).slice(0, 10);
    }
    startQuizEngine(600); 
}

function startQuizEngine(timeInSeconds) {
    if(currentQuizData.length === 0) {
        alert("No questions found."); return;
    }
    userAnswers = {};
    currentQuestionIndex = 0;
    timeLeftRemaining = timeInSeconds;
    showView('quiz-ui');
    renderQuestion();
    startTimer();
}

function renderQuestion() {
    let qData = currentQuizData[currentQuestionIndex];
    document.getElementById('question-text').innerText = `Q${currentQuestionIndex + 1}: ${qData['Question Text']}`;
    
    let container = document.getElementById('options-container');
    let optionsHTML = '';
    
    // Check if Fill-in-the-Blank
    if (qData['Question Type'] === 'FITB') {
        let currentAns = userAnswers[currentQuestionIndex] || '';
        optionsHTML = `<input type="text" id="fitb-input" class="fitb-input" placeholder="Type your answer here..." value="${currentAns}" onkeyup="selectFITB(this.value)">`;
    } 
    // Otherwise, render Multiple Choice
    else {
        let options = ['A', 'B', 'C', 'D']; 
        options.forEach(opt => {
            let optText = qData[`Option ${opt}`];
            if (optText) {
                let isSelected = userAnswers[currentQuestionIndex] === optText ? 'selected' : '';
                optionsHTML += `<button class="option-btn ${isSelected}" onclick="selectOption('${optText}')">${opt}. ${optText}</button>`;
            }
        });
    }
    container.innerHTML = optionsHTML;
}

function selectOption(text) {
    userAnswers[currentQuestionIndex] = text;
    renderQuestion(); 
}

function selectFITB(text) {
    userAnswers[currentQuestionIndex] = text;
}

function prevQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuizData.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeftRemaining--;
        let minutes = Math.floor(timeLeftRemaining / 60);
        let seconds = timeLeftRemaining % 60;
        document.getElementById('time').innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        if (timeLeftRemaining <= 0) {
            clearInterval(timerInterval);
            calculateScore(); 
        }
    }, 1000);
}

function showReview() {
    if(confirm("Submit your answers?")) calculateScore();
}

function calculateScore() {
    clearInterval(timerInterval);
    let score = 0;
    let reviewHTML = '';

    currentQuizData.forEach((qData, index) => {
        let userAns = userAnswers[index] || "Unanswered";
        let correctAns = qData['Correct Answer'] || "Not Defined"; 
        
        // Robust grading: ignore casing and trailing spaces
        let isCorrect = userAns.toString().trim().toLowerCase() === correctAns.toString().trim().toLowerCase();

        if (isCorrect) score++;

        let cardClass = isCorrect ? 'correct' : 'incorrect';
        let statusText = isCorrect 
            ? `<p class="result-status status-correct">✓ Correct</p>`
            : `<p class="result-status status-incorrect">✗ Incorrect. You answered: ${userAns}</p>
               <p style="margin:0;"><b>Correct Answer:</b> ${correctAns}</p>`;

        let explanation = qData['Explanation'] 
            ? `<div class="explanation-box"><b>Explanation:</b> ${qData['Explanation']}</div>` 
            : '';

        reviewHTML += `
            <div class="result-card ${cardClass}">
                <p class="result-question">Q${index + 1}: ${qData['Question Text']}</p>
                ${statusText}
                ${explanation}
            </div>
        `;
    });

    document.getElementById('score-display').innerText = `You scored ${score} out of ${currentQuizData.length}`;
    document.getElementById('review-container').innerHTML = reviewHTML;
    showView('results');
}
