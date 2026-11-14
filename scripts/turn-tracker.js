// Embedded in the bookmarklet by build-edunext.cjs. No provider secrets live here.
function readEduNextTurn(doc) {
  const text = element => (element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
  const visible = element => !element.closest('#enx-pro-hud') && element.getClientRects().length > 0;
  const after = (element, anchor) => !anchor || (!element.contains(anchor) && Boolean(anchor.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING));
  const all = selector => Array.from(doc.querySelectorAll(selector)).filter(visible);

  // 1. Locate student badge (supports Vietnamese and English)
  const students = all('span, p, small, label, div, b, strong').filter(element => {
    const t = text(element);
    return /^(?:học\s*sinh|sinh\s*viên|student|bạn\s*\(sinh\s*viên\))$/i.test(t) &&
      !Array.from(element.children).some(child => /^(?:học\s*sinh|sinh\s*viên|student)$/i.test(text(child)));
  });
  const studentBadge = students.at(-1) || null;
  const studentMessage = studentBadge ? (studentBadge.closest('.wrap-message-view, [class*="message-item"], [class*="chat-item"], .chat-message, [class*="message"], [class*="chat"], div') || studentBadge) : null;

  // 2. Locate teacher markers that appear AFTER the student message
  const teacherMarkers = all('div, span, p, button, a, small, label, b, strong').filter(element => {
    if (!after(element, studentBadge)) return false;
    const txt = text(element);
    return /graded\s*by\s*ai|đã\s*chấm\s*bằng\s*ai|^int:\s*\w+|feedback|correct!|incorrect|you've\s*got\s*a\s*solid\s*grasp|on\s*to\s*the\s*next\s*question/i.test(txt);
  });
  const hasTeacherResponse = teacherMarkers.length > 0;

  // 3. Locate question content
  function findQuestion() {
    const allCandidates = all('div, section, article, p, span, h1, h2, h3, h4, h5, h6, [class*="question"], [class*="exercise"]');
    // Prioritize candidates appearing AFTER the student message, but fall back to all candidates if needed
    const afterCandidates = studentBadge ? allCandidates.filter(el => after(el, studentBadge)) : allCandidates;
    const searchSets = afterCandidates.length > 0 ? [afterCandidates, allCandidates] : [allCandidates];

    for (let s = 0; s < searchSets.length; s++) {
      const candidates = searchSets[s];

      // A. Explicit heading elements containing "Câu hỏi:" or "Question:"
      const headings = candidates.filter(el => {
        const t = text(el);
        return /(?:câu\s*hỏi|question|bài\s*sau|đề\s*bài|exercise)\s*:/i.test(t) ||
               /^(?:câu\s*hỏi|question|bài\s*sau|đề\s*bài|exercise)$/i.test(t);
      });
      if (headings.length > 0) {
        const h = headings[headings.length - 1];
        let curr = h;
        let best = h;
        while (curr && curr !== doc.body) {
          const cText = text(curr);
          if (cText.length > 25 && (cText.includes('?') || cText.includes('\n') || /answer|format|đáp\s*án/i.test(cText))) {
            best = curr;
            break;
          }
          curr = curr.parentElement;
        }
        return { element: best, text: text(best) };
      }

      // B. Element with "Please answer using this format:" or "Answer: [your answer]" or "Trả lời: [đáp án của bạn]"
      const formats = candidates.filter(el => {
        const t = text(el);
        return /(?:please\s*answer\s*using\s*this\s*format|answer\s*:\s*\[|trả\s*lời\s*:\s*\[)/i.test(t);
      });
      if (formats.length > 0) {
        const fmt = formats[formats.length - 1];
        let curr = fmt;
        let best = fmt;
        while (curr && curr !== doc.body) {
          const cText = text(curr);
          if (cText.length > 30 && (cText.includes('?') || /câu\s*hỏi|question|sentence|select|which/i.test(cText))) {
            best = curr;
            break;
          }
          curr = curr.parentElement;
        }
        return { element: best, text: text(best) };
      }

      // C. Class-based fallback
      const qBoxes = candidates.filter(el => el.matches && el.matches('.exercise-question-block, [class*="exercise-question"], [class*="question-content"], .question-title, [class*="question-box"]'));
      if (qBoxes.length > 0) {
        const lastQ = qBoxes[qBoxes.length - 1];
        return { element: lastQ, text: text(lastQ) };
      }

      // D. General question text ending with '?' or containing question phrases
      const questionTextEls = candidates.filter(el => {
        const t = text(el);
        return t.length > 25 && t.length < 1500 && (t.includes('?') || /modal\s*verb|obligation|generation\s*gap|which\s+term|describes/i.test(t));
      });
      if (questionTextEls.length > 0) {
        const lastQ = questionTextEls[questionTextEls.length - 1];
        return { element: lastQ, text: text(lastQ) };
      }
    }

    return null;
  }

  const qFound = findQuestion();
  const content = qFound ? qFound.element : (teacherMarkers.at(-1) || null);
  const questionBlockText = qFound ? qFound.text : (content ? text(content) : '');

  // Locate the entire teacher message container (bubble) to capture full feedback and hints
  let teacherContainer = null;
  if (content) {
    let curr = content.parentElement;
    while (curr && curr !== doc.body && (!studentMessage || !curr.contains(studentMessage))) {
      const cTxt = text(curr);
      if (cTxt.length > (questionBlockText.length + 15)) {
        teacherContainer = curr;
        break;
      }
      curr = curr.parentElement;
    }
    if (!teacherContainer) {
      teacherContainer = content.closest('.wrap-message-view, [class*="message-item"], [class*="chat-item"], .chat-message, [class*="message"], [class*="chat"], div') || content;
    }
  }

  // Extract hints explicitly
  const hintEls = all('div, p, span, small').filter(el => {
    if (studentBadge && !after(el, studentBadge)) return false;
    const t = text(el);
    return /^(?:hint|gợi\s*ý|concept\s*check|question\s*analysis)\s*[:]/i.test(t) ||
           /(?:take\s*another\s*look|looks\s*like\s*you\s*provided|not\s*quite\s*work\s*here|current\s*answer\s*is\s*incorrect|misunderstood\s*the\s*question)/i.test(t);
  });
  const hintText = hintEls.map(el => text(el)).filter(Boolean).join('\n');

  const fullTeacherMsg = teacherContainer ? text(teacherContainer) : (content ? text(content) : '');
  const lastTeacherMsg = fullTeacherMsg || questionBlockText;
  const imageIds = content ? Array.from(content.querySelectorAll('img')).map(image => image.currentSrc || image.src).join('|') : '';

  // 4. Composer input detection
  const activeInput = all('textarea.w-md-editor-text-input, .w-md-editor textarea, textarea, input[type="text"]')
    .find(el => !el.disabled && !el.readOnly && el.offsetParent !== null);

  // 5. Dead Conversation & Rate Limit Detection (ONLY in recent bubbles, NEVER global doc.body!)
  const chatBubbles = all('.wrap-message-view, [class*="message-item"], [class*="chat-item"], .chat-message, [class*="message"], [class*="chat"]');
  const recentBubbles = chatBubbles.slice(-3);
  const recentText = recentBubbles.map(b => text(b)).join(' ');

  const isDeadConversation = /(?:this\s*conversation\s*can\s*no\s*longer\s*be\s*continued|start\s*a\s*new\s*chat|cuộc\s*trò\s*chuyện\s*này\s*không\s*thể\s*tiếp\s*tục|bắt\s*đầu\s*cuộc\s*trò\s*chuyện\s*mới)/i.test(recentText);
  const rateLimitMatch = recentText.match(/(?:Too\s*many\s*requests.*?after|vui\s*lòng\s*thử\s*lại\s*sau|yêu\s*cầu\s*quá\s*nhanh.*?sau)\s*(\d+)\s*(?:seconds|giây)/i) ||
                         recentText.match(/(\d+)\s*(?:giây|seconds).*?(?:thử\s*lại|try\s*again)/i);
  const rateLimitSeconds = rateLimitMatch ? parseInt(rateLimitMatch[1], 10) : 0;

  // 6. State classification
  let state = 'idle';
  if (isDeadConversation || rateLimitSeconds > 30) {
    state = 'need_new_chat';
  } else if (rateLimitSeconds > 0) {
    state = 'rate_limited';
  } else if (activeInput && !activeInput.disabled) {
    // If the input box is active and enabled, student is allowed to type!
    state = 'student_turn';
  } else if (questionBlockText && (questionBlockText.includes('?') || /câu\s*hỏi|question|answer\s*:|which|what|select|choose/i.test(questionBlockText))) {
    state = 'student_turn';
  } else if (hasTeacherResponse) {
    state = 'student_turn';
  } else if (studentBadge && !hasTeacherResponse) {
    state = 'waiting_teacher';
  } else if (studentBadge) {
    state = 'waiting_teacher';
  }

  const fingerprint = [
    doc.location?.href || '',
    studentBadge ? (studentBadge.id || text(studentBadge)) : '',
    content ? (content.id || questionBlockText.slice(0, 100)) : '',
    imageIds
  ].join('\n');

  return {
    state,
    isDeadConversation,
    rateLimitSeconds,
    lastStudentBadge: studentBadge,
    lastTeacherBadge: teacherMarkers.at(-1) || null,
    lastStudentMsg: studentMessage ? text(studentMessage) : '',
    lastTeacherMsg,
    fullTeacherMsg,
    hintText,
    questionBlockText,
    fingerprint,
    imageIds
  };
}
