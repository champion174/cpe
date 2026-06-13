// ==========================================
// 1. CONFIGURATION (ADD YOUR CSV LINK HERE)
// ==========================================
// IMPORTANT: Ensure your Google Sheet is "Published to Web" as a CSV.
const CSV_URL = "YOUR_CSV_LINK_HERE"; 

// Global State Variables
let masterDatabase = [];
let currentQuizData = [];
let userAnswers = {}; // Stores answers as { questionIndex: "A" }
let currentQuestionIndex = 0;
let timerInterval;
let timeLeftRemaining = 0;

// ==========================================
// 2. INITIALIZATION & DATA FETCHING
// ==========================================
window.onload = () => {
    // Fetch the CSV and parse it into an array of objects
    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            masterDatabase = results.data;
            console.log("Database Loaded:", masterDatabase);
            showView('home'); // Show home screen once data is ready
        },
        error: function(err) {
            document.getElementById('loading').innerHTML = "<h2>Error loading database. Check the CSV link.</h2>";
        }
    });
};

// ==========================================
// 3. ROUTING / VIEW MANAGEMENT
// ==========================================
function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    clearInterval(timerInterval); // Reset timer when changing views
}

// ==========================================
// 4. QUIZ SETUP LOGIC
// ==========================================

// Starts the "Daily 5" using the current date to seed the randomization
function startDaily5() {
    let today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    
    // Simple filter to get one of each (expand this based on your exact column names)
    let organic = masterDatabase.filter(q => q.Category === "Organic");
    let physical = masterDatabase.filter(q => q.Category === "Physical");
    let inorganic = masterDatabase.filter(q => q.Category === "Inorganic");
    let aptitude = masterDatabase.filter(q => q.Category === "Aptitude");

    currentQuizData = [
        organic[0] || masterDatabase[0],   // Fallback to random if category is empty
        physical[0] || masterDatabase[1],  
        inorganic[0] || masterDatabase[2],
        aptitude[0] || masterDatabase[3],
        masterDatabase[Math.floor(Math.random() * masterDatabase.length)] // Wildcard
    ].filter(Boolean); // Remove undefined if database is too small

    startQuizEngine(300); // Start with 5 minutes (300 seconds)
}

function startCustomPractice() {
    let category = document.getElementById('category-filter').value;
    
    if (category === "All") {
        currentQuizData = [...masterDatabase].sort(() => 0.5 - Math.random()).slice(0, 10); // 10 random
    } else {
        currentQuizData = masterDatabase.filter(q => q.Category === category).slice(0, 10);
    }
    
    startQuizEngine(600); // Start with 10 minutes (600 seconds)
}

// ==========================================
// 5. ACTIVE QUIZ ENGINE & TIMER
// ==========================================
function startQuizEngine(timeInSeconds) {
    if(currentQuizData.length === 0) {
        alert("No questions found for this selection.");
        return;
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
    document.getElementById('question-text').innerText = `${currentQuestionIndex + 1}. ${qData['Question Text']}`; // Assumes your column is named 'Question Text'
    
    let optionsHTML = '';
    // Assumes your columns are Option A, Option B, etc.
    let options = ['A', 'B', 'C', 'D']; 
    
    options.forEach(opt => {
        let optText = qData[`Option ${opt}`];
        if (optText) {
            let isSelected = userAnswers[currentQuestionIndex] === optText ? 'selected' : '';
            optionsHTML += `<button class="option-btn ${isSelected}" onclick="selectOption('${optText}')">${opt}: ${optText}</button>`;
        }
    });
    
    document.getElementById('options-container').innerHTML = optionsHTML;
}

function selectOption(text) {
    userAnswers[currentQuestionIndex] = text;
    renderQuestion(); // Re-render to highlight selection
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
            calculateScore(); // Auto submit
        }
    }, 1000);
}

// ==========================================
// 6. SCORING AND REVIEW
// ==========================================
function showReview() {
    if(confirm("Are you sure you want to submit your answers?")) {
        calculateScore();
    }
}

function calculateScore() {
    clearInterval(timerInterval);
    let score = 0;
    let reviewHTML = '';

    currentQuizData.forEach((qData, index) => {
        let userAns = userAnswers[index] || "Unanswered";
        // Assumes your sheet has a 'Correct Answer' column containing the exact text of the right option
        let correctAns = qData['Correct Answer']; 
        
        if (userAns === correctAns) {
            score++;
            reviewHTML += `<p style="color: green;"><b>Q${index + 1}: Correct!</b> (${correctAns})</p>`;
        } else {
            reviewHTML += `<p style="color: red;"><b>Q${index + 1}: Incorrect.</b> You answered: ${userAns} | Correct: ${correctAns}</p>`;
        }
    });

    document.getElementById('score-display').innerText = `You scored ${score} out of ${currentQuizData.length}`;
    document.getElementById('review-container').innerHTML = reviewHTML;
    showView('results');
}
