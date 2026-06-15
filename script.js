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
    let questionHTML = `<h3 style="margin-top: 0;">Q${currentQuestionIndex + 1}: ${qData['Question Text']}</h3>`;
    
    if (qData['Image URL'] && qData['Image URL'].trim() !== '') {
        questionHTML += `<img src="${qData['Image URL']}" alt="Question Image" style="max-width: 100%; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">`;
    }
    
    document.getElementById('question-text').innerHTML = questionHTML;
    
    let container = document.getElementById('options-container');
    let optionsHTML = '';
    
    // Robust check for FITB: Converts to uppercase and removes spaces
    let qType = qData['Question Type'] ? String(qData['Question Type']).trim().toUpperCase() : '';

    if (qType === 'FITB') {
        let currentAns = userAnswers[currentQuestionIndex] || '';
        optionsHTML = `<input type="text" id="fitb-input" class="fitb-input" placeholder="Type your answer here..." value="${currentAns}" onkeyup="selectFITB(this.value)">`;
    } else {
        let options = ['A', 'B', 'C', 'D']; 
        options.forEach(opt => {
            let optText = qData[`Option ${opt}`];
            if (optText) {
                let isSelected = userAnswers[currentQuestionIndex] === optText ? 'selected' : '';
                let displayContent = optText;
                if (optText.startsWith('http') && (optText.match(/\.(jpeg|jpg|gif|png)$/) != null)) {
                    displayContent = `<img src="${optText}" style="max-width: 200px; max-height: 100px; display: block; margin-top: 0.5rem;">`;
                }
                optionsHTML += `<button class="option-btn ${isSelected}" onclick="selectOption('${optText}')">
                                    <b>${opt}.</b> ${displayContent}
                                </button>`;
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
        let correctAns = qData['Correct Answer'] || ""; 
        let qType = qData['Question Type'] ? String(qData['Question Type']).trim().toUpperCase() : '';
        
        let isCorrect = userAns.toString().trim().toLowerCase() === correctAns.toString().trim().toLowerCase();
        if (isCorrect) score++;

        let cardClass = isCorrect ? 'correct' : 'incorrect';
        let statusText = isCorrect 
            ? `<p class="result-status status-correct" style="margin-bottom: 0.5rem;">✓ Correct</p>`
            : `<p class="result-status status-incorrect" style="margin-bottom: 0.5rem;">✗ Incorrect</p>`;

        let optionsReviewHTML = '';

        // If it's Multiple Choice, render all options with colors
        if (qType !== 'FITB') {
            ['A', 'B', 'C', 'D'].forEach(opt => {
                let optText = qData[`Option ${opt}`];
                if (optText) {
                    let isUserChoice = (userAns === optText);
                    let isActualCorrect = (correctAns === optText);
                    
                    let bgStyle = 'background: transparent; border: 1px solid #e2e8f0;';
                    let textStyle = 'color: #0f172a;';
                    let icon = '';

                    if (isActualCorrect) {
                        bgStyle = 'background: #dcfce7; border: 1px solid #22c55e;';
                        textStyle = 'color: #15803d; font-weight: bold;';
                        icon = ' ✓';
                    } else if (isUserChoice && !isActualCorrect) {
                        bgStyle = 'background: #fee2e2; border: 1px solid #ef4444;';
                        textStyle = 'color: #b91c1c;';
                        icon = ' (Your Answer)';
                    }

                    optionsReviewHTML += `
                        <div style="${bgStyle} ${textStyle} padding: 0.5rem; margin-top: 0.25rem; border-radius: 6px; font-size: 0.95rem;">
                            ${opt}. ${optText} ${icon}
                        </div>`;
                }
            });
        } else {
            // If it's FITB, just show what they typed vs the correct string
            optionsReviewHTML = `
                <div style="background: #f8fafc; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem;">
                    <p style="margin: 0; color: #64748b;">Your Answer: <b>${userAns}</b></p>
                    <p style="margin: 0.25rem 0 0 0; color: #15803d;">Correct Answer: <b>${correctAns}</b></p>
                </div>
            `;
        }

        let explanation = qData['Explanation'] 
            ? `<div class="explanation-box" style="margin-top: 1rem;"><b>Explanation:</b> ${qData['Explanation']}</div>` 
            : '';

        reviewHTML += `
            <div class="result-card ${cardClass}">
                <p class="result-question">Q${index + 1}: ${qData['Question Text']}</p>
                ${statusText}
                ${optionsReviewHTML}
                ${explanation}
            </div>
        `;
    });

    document.getElementById('score-display').innerText = `You scored ${score} out of ${currentQuizData.length}`;
    document.getElementById('review-container').innerHTML = reviewHTML;
    showView('results');
}
