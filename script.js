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

// --- BULLETPROOF DATA FETCHER ---
function getCol(rowObj, targetName) {
    if (rowObj[targetName] !== undefined && rowObj[targetName] !== '') return rowObj[targetName];
    let cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let key in rowObj) {
        let cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanKey === cleanTarget) {
            return rowObj[key];
        }
    }
    return '';
}

window.onload = () => {
    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        transformHeader: function(h) { return h.trim(); }, 
        complete: function(results) {
            masterDatabase = results.data;
            console.log("Database Loaded.");
            showView('home'); 
        },
        error: function(err) {
            document.getElementById('loading').innerHTML = "<h2>Error loading database. Check the CSV link.</h2>";
        }
    });
};

function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    clearInterval(timerInterval); 
}

// --- NEW HELPER: Shuffles an array randomly ---
function shuffleArray(array) {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function startDaily5() {
    // 1. Filter out completely blank rows
    let validDB = masterDatabase.filter(q => getCol(q, 'Question Text').trim() !== '' || getCol(q, 'Image URL').trim() !== '');

    let organic = validDB.filter(q => getCol(q, 'Category') === "Organic");
    let physical = validDB.filter(q => getCol(q, 'Category') === "Physical");
    let inorganic = validDB.filter(q => getCol(q, 'Category') === "Inorganic");
    let aptitude = validDB.filter(q => getCol(q, 'Category') === "Aptitude");

    let selectedQuestions = [];

    // 2. Safely grab one random question from each category (if available)
    if (organic.length > 0) selectedQuestions.push(shuffleArray(organic)[0]);
    if (physical.length > 0) selectedQuestions.push(shuffleArray(physical)[0]);
    if (inorganic.length > 0) selectedQuestions.push(shuffleArray(inorganic)[0]);
    if (aptitude.length > 0) selectedQuestions.push(shuffleArray(aptitude)[0]);

    // 3. Fill the remaining slots up to 5 with UNIQUE wildcards
    let remainingPool = shuffleArray(validDB.filter(q => !selectedQuestions.includes(q)));
    
    while (selectedQuestions.length < 5 && remainingPool.length > 0) {
        selectedQuestions.push(remainingPool.pop());
    }

    // 4. Shuffle the final 5 so Categories don't always appear in the same order
    currentQuizData = shuffleArray(selectedQuestions);
    startQuizEngine(300); 
}

function startCustomPractice() {
    let validDB = masterDatabase.filter(q => getCol(q, 'Question Text').trim() !== '' || getCol(q, 'Image URL').trim() !== '');
    let category = document.getElementById('category-filter').value;
    
    let pool = (category === "All") ? validDB : validDB.filter(q => getCol(q, 'Category') === category);

    // Shuffle the pool and take the first 10 strictly unique questions
    currentQuizData = shuffleArray(pool).slice(0, 10);
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
    let qText = getCol(qData, 'Question Text');
    let qImage = getCol(qData, 'Image URL');
    let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
    
    // Auto-detect if the Question Text is actually an image URL
    let qTextDisplay = qText;
    if (qText.startsWith('http') && (qText.match(/\.(jpeg|jpg|gif|png)$/i) != null)) {
        qTextDisplay = `<img src="${qText}" style="max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0;">`;
    }

    let questionHTML = `<h3 style="margin-top: 0;">Q${currentQuestionIndex + 1}: ${qTextDisplay}</h3>`;
    
    // Support for dedicated Image URL column
    if (qImage !== '') {
        questionHTML += `<img src="${qImage}" style="max-width: 100%; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #e2e8f0;">`;
    }
    
    document.getElementById('question-text').innerHTML = questionHTML;
    
    let container = document.getElementById('options-container');
    let optionsHTML = '';
    
    if (qType === 'FITB') {
        let currentAns = userAnswers[currentQuestionIndex] || '';
        optionsHTML = `<input type="text" id="fitb-input" class="fitb-input" placeholder="Type your answer here..." value="${currentAns}" onkeyup="selectFITB(this.value)">`;
    } else {
        let options = ['A', 'B', 'C', 'D']; 
        options.forEach(opt => {
            let optText = getCol(qData, `Option ${opt}`);
            if (optText) {
                let isSelected = userAnswers[currentQuestionIndex] === optText ? 'selected' : '';
                let displayContent = optText;
                
                if (optText.startsWith('http') && (optText.match(/\.(jpeg|jpg|gif|png)$/i) != null)) {
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
        let rawCorrect = String(getCol(qData, 'Correct Answer')).trim();
        let qType = String(getCol(qData, 'Question Type')).trim().toUpperCase();
        let explanationText = getCol(qData, 'Explanation');
        
        // Resolve A/B/C/D to actual text
        let correctAnsText = rawCorrect;
        if (/^[A-D]$/i.test(rawCorrect)) {
            correctAnsText = String(getCol(qData, `Option ${rawCorrect.toUpperCase()}`)).trim();
        }

        // Fuzzy match for overall question grade
        let isCorrect = userAns.toString().trim().toLowerCase() === correctAnsText.toLowerCase();
        if (isCorrect) score++;

        let cardClass = isCorrect ? 'correct' : 'incorrect';
        let statusText = isCorrect 
            ? `<p class="result-status status-correct" style="margin-bottom: 0.5rem;">✓ Correct</p>`
            : `<p class="result-status status-incorrect" style="margin-bottom: 0.5rem;">✗ Incorrect</p>`;

        let optionsReviewHTML = '';

        if (qType !== 'FITB') {
            ['A', 'B', 'C', 'D'].forEach(opt => {
                let optText = getCol(qData, `Option ${opt}`);
                if (optText) {
                    // THE FIX: Fuzzy match for the option highlights to ignore spaces and casing
                    let cleanUserChoice = userAns.toString().trim().toLowerCase();
                    let cleanActualCorrect = correctAnsText.toString().trim().toLowerCase();
                    let cleanOptText = optText.toString().trim().toLowerCase();

                    let isUserChoice = (cleanUserChoice === cleanOptText);
                    let isActualCorrect = (cleanActualCorrect === cleanOptText);
                    
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

                    // Options images can stay slightly smaller to fit the boxes nicely
                    let displayContent = optText;
                    if (optText.startsWith('http') && (optText.match(/\.(jpeg|jpg|gif|png)$/i) != null)) {
                        displayContent = `<img src="${optText}" style="max-width: 250px; max-height: 150px; display: block; margin-top: 0.25rem;">`;
                    }

                    optionsReviewHTML += `
                        <div style="${bgStyle} ${textStyle} padding: 0.5rem; margin-top: 0.25rem; border-radius: 6px; font-size: 0.95rem;">
                            ${opt}. ${displayContent} ${icon}
                        </div>`;
                }
            });
        } else {
            optionsReviewHTML = `
                <div style="background: #f8fafc; padding: 0.5rem; border-radius: 6px; margin-top: 0.5rem;">
                    <p style="margin: 0; color: #64748b;">Your Answer: <b>${userAns}</b></p>
                    <p style="margin: 0.25rem 0 0 0; color: #15803d;">Correct Answer: <b>${correctAnsText}</b></p>
                </div>
            `;
        }

        let explanationBlock = explanationText !== '' 
            ? `<div class="explanation-box" style="margin-top: 1rem; background: #e0f2fe; padding: 1rem; border-radius: 8px; font-size: 0.95rem; border: 1px solid #bae6fd;"><b>Explanation:</b> ${explanationText}</div>` 
            : '';

        // THE FIX: Render question images at full width in the review screen
        let qText = getCol(qData, 'Question Text');
        let qImage = getCol(qData, 'Image URL');
        let qTextDisplay = qText;
        
        // Auto-detect if Question text is an image
        if (qText.startsWith('http') && (qText.match(/\.(jpeg|jpg|gif|png)$/i) != null)) {
            qTextDisplay = `<img src="${qText}" style="max-width: 100%; border-radius: 8px; margin-top: 0.5rem; display: block; border: 1px solid #e2e8f0;">`;
        }

        // Render the dedicated Image column if it exists
        if (qImage !== '') {
            qTextDisplay += `<img src="${qImage}" style="max-width: 100%; border-radius: 8px; margin-top: 1rem; display: block; border: 1px solid #e2e8f0;">`;
        }

        reviewHTML += `
            <div class="result-card ${cardClass}" style="background: #f8fafc; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border-left: 6px solid ${isCorrect ? '#22c55e' : '#ef4444'};">
                <p class="result-question" style="font-weight: 600; font-size: 1.1rem; margin-top: 0;">Q${index + 1}: ${qTextDisplay}</p>
                ${statusText}
                ${optionsReviewHTML}
                ${explanationBlock}
            </div>
        `;
    });

    document.getElementById('score-display').innerText = `You scored ${score} out of ${currentQuizData.length}`;
    document.getElementById('review-container').innerHTML = reviewHTML;
    showView('results');
}
