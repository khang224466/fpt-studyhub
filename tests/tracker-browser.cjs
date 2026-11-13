const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="chat"></main>');
    await page.addScriptTag({ content: fs.readFileSync('scripts/turn-tracker.js', 'utf8') });
    const result = await page.evaluate(() => {
      const chat = document.getElementById('chat'); const results = [];
      chat.innerHTML = '<div class="wrap-message-view">Câu hỏi: câu cũ?<button>Feedback</button></div><div class="wrap-message-view student"><span>Học sinh</span><p>Trả lời: A</p></div>';
      results.push(readEduNextTurn(document).state === 'waiting_teacher');
      chat.insertAdjacentHTML('beforeend', '<div class="exercise-question-block">Câu hỏi: câu mới? Trả lời: [...]</div>');
      let turn = readEduNextTurn(document);
      results.push(turn.state === 'student_turn' && turn.questionBlockText.includes('câu mới'));
      // Same introductory 150 characters, different question suffix.
      const question = chat.lastElementChild;
      question.textContent = 'Câu hỏi: ' + 'a'.repeat(160) + ' 1?';
      const first = readEduNextTurn(document).fingerprint;
      question.textContent = 'Câu hỏi: ' + 'a'.repeat(160) + ' 2?';
      results.push(first !== readEduNextTurn(document).fingerprint);
      question.innerHTML = '<img src="data:image/png;base64,YQ==">';
      turn = readEduNextTurn(document);
      results.push(turn.state === 'student_turn');
      const imageFirst = turn.fingerprint;
      question.querySelector('img').src = 'data:image/png;base64,Yg==';
      results.push(imageFirst !== readEduNextTurn(document).fingerprint);
      question.remove();
      chat.insertAdjacentHTML('beforeend', '<div class="wrap-message-view">Chưa đúng. Kiểm tra lại bước tính.</div>');
      results.push(readEduNextTurn(document).lastTeacherMsg.includes('Chưa đúng'));
      chat.insertAdjacentHTML('beforeend', '<div id="enx-pro-hud"><span>Học sinh</span><div class="exercise-question-block">Câu hỏi giả trong HUD</div></div>');
      results.push(!readEduNextTurn(document).questionBlockText.includes('giả'));
      chat.insertAdjacentHTML('beforeend', '<div class="exercise-question-block" style="display:none">Câu bị ẩn</div>');
      results.push(!readEduNextTurn(document).questionBlockText.includes('bị ẩn'));
      chat.innerHTML = '<div class="wrap-message-view">Câu hỏi đầu tiên? Trả lời: [...]</div>';
      results.push(readEduNextTurn(document).state === 'student_turn');
      return results;
    });
    result.forEach((passed, i) => assert.equal(passed, true, `Tracker scenario ${i + 1}`));
    console.log(`${result.length} browser tracker scenarios passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
