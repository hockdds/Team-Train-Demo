window.TT_DEMO_CONTENT = {
 "logins": {
  "owner": {
   "email": "demo-owner@example.com",
   "password": "DemoOwner!2026",
   "label": "Owner / manager view"
  },
  "staff": {
   "email": "demo-assistant@example.com",
   "password": "DemoAssistant!2026",
   "label": "Dental assistant view"
  }
 },
 "modules": [
  {
   "title": "Handpiece Sterilization",
   "required": 1,
   "summary": "Process, sterilize and log a dental handpiece correctly after every patient.",
   "lessons": [
    {
     "title": "Processing a handpiece after each patient",
     "body": "A handpiece goes in the patient's mouth, so it must be cleaned, lubricated and sterilized **between every patient**, with no exceptions.\n\nThe order matters: flushing comes first so debris is cleared from the inside before the outside is wiped.\n\nNever skip lubrication. It extends the life of the bearings.",
     "key_points": [],
     "steps": [
      "Remove the handpiece from the delivery unit.",
      "Run it for 20 to 30 seconds to flush water and air.",
      "Wipe the exterior with a disinfectant wipe.",
      "Lubricate with the approved lubricant.",
      "Place it in a sealed sterilization pouch.",
      "Autoclave at 273 F for 6 minutes.",
      "Record the cycle in the sterilization log."
     ],
     "scenario": {
      "situation": "The schedule is running behind and the next patient is already seated. You are tempted to wipe the handpiece and put it straight into a pouch.",
      "response": "Do not skip step 4. Lubricate before bagging, then finish every remaining step.",
      "why": "Skipping lubrication shortens the life of the bearings."
     }
    },
    {
     "title": "Weekly spore testing",
     "body": "Spore testing proves the autoclave is actually killing microorganisms. Check the result **every week**.\n\nIf a spore test fails, **stop using that autoclave immediately** and tell the office manager. Do not run another load until the manager clears it.",
     "key_points": [
      "Check the spore test result every week",
      "A failed test: stop using the autoclave and tell the office manager"
     ],
     "steps": [],
     "scenario": null
    }
   ],
   "questions": [
    {
     "prompt": "After flushing, what comes next?",
     "options": [
      "Lubricate",
      "Wipe the exterior with a disinfectant wipe",
      "Autoclave",
      "Record the cycle"
     ],
     "answer": 1,
     "explanation": "Step 3 is wiping the exterior after flushing.",
     "lesson": 1,
     "kind": "check"
    },
    {
     "prompt": "How often is the spore test result checked?",
     "options": [
      "Every day",
      "Every week",
      "Every month"
     ],
     "answer": 1,
     "explanation": "Spore test results are checked every week.",
     "lesson": 2,
     "kind": "check"
    },
    {
     "prompt": "How long do you run the handpiece to flush it?",
     "options": [
      "5 to 10 seconds",
      "20 to 30 seconds",
      "2 minutes",
      "No flush is needed"
     ],
     "answer": 1,
     "explanation": "Step 2: 20 to 30 seconds.",
     "lesson": 1,
     "kind": "final"
    },
    {
     "prompt": "The autoclave cycle for handpieces is:",
     "options": [
      "250 F for 3 minutes",
      "273 F for 6 minutes",
      "300 F for 10 minutes",
      "212 F for 20 minutes"
     ],
     "answer": 1,
     "explanation": "273 F for 6 minutes.",
     "lesson": 1,
     "kind": "final"
    },
    {
     "prompt": "A spore test fails. What do you do?",
     "options": [
      "Keep using the autoclave and retest next week",
      "Stop using that autoclave immediately and tell the office manager"
     ],
     "answer": 1,
     "explanation": "A failed test means stop and tell the office manager.",
     "lesson": 2,
     "kind": "final"
    },
    {
     "prompt": "Lubrication is optional when the schedule is busy.",
     "options": [
      "True",
      "False"
     ],
     "answer": 1,
     "explanation": "Never skip lubrication; it protects the bearings.",
     "lesson": 1,
     "kind": "final"
    }
   ]
  },
  {
   "title": "Hand Hygiene and Gloves",
   "required": 0,
   "summary": "Know when to clean your hands and how to put on and remove gloves safely.",
   "lessons": [
    {
     "title": "When to clean your hands",
     "body": "Clean your hands **before and after** every patient contact, and **before putting on** and **after removing** gloves.\n\nUse soap and water when your hands are visibly soiled. Otherwise an alcohol-based hand rub is fine.",
     "key_points": [
      "Before and after patient contact",
      "Before gloving and after removing gloves",
      "Soap and water if visibly soiled"
     ],
     "steps": [],
     "scenario": null
    },
    {
     "title": "Putting on and removing gloves",
     "body": "Gloves are for one patient and one task. Change them between patients and whenever they tear or become contaminated.",
     "key_points": [],
     "steps": [
      "Clean your hands.",
      "Put on gloves, covering the cuffs of your gown or sleeves.",
      "After the procedure, remove the first glove by pinching the outside at the wrist.",
      "Peel the second glove off over the first and discard both.",
      "Clean your hands again."
     ],
     "scenario": {
      "situation": "You finish with a patient, and the next one is waiting. The gloves look fine and you are in a hurry.",
      "response": "Remove them and clean your hands before touching anything else (steps 3 to 5).",
      "why": "Gloves are single-patient and become contaminated even when they look clean."
     }
    }
   ],
   "questions": [
    {
     "prompt": "When must you clean your hands?",
     "options": [
      "Only at the start of the day",
      "Before and after patient contact and around glove use",
      "Only if they look dirty"
     ],
     "answer": 1,
     "explanation": "Hand hygiene surrounds patient contact and glove use.",
     "lesson": 1,
     "kind": "check"
    },
    {
     "prompt": "How many patients can one pair of gloves be used for?",
     "options": [
      "One",
      "Two",
      "As long as they look clean"
     ],
     "answer": 0,
     "explanation": "Gloves are single-patient.",
     "lesson": 2,
     "kind": "check"
    },
    {
     "prompt": "Your hands are visibly soiled. You should use:",
     "options": [
      "Alcohol hand rub only",
      "Soap and water",
      "Nothing until the end of the day"
     ],
     "answer": 1,
     "explanation": "Visibly soiled hands need soap and water.",
     "lesson": 1,
     "kind": "final"
    },
    {
     "prompt": "What is the last step after removing gloves?",
     "options": [
      "Put on a new pair",
      "Clean your hands again",
      "Touch the next patient chart"
     ],
     "answer": 1,
     "explanation": "Clean your hands again.",
     "lesson": 2,
     "kind": "final"
    }
   ]
  },
  {
   "title": "Front Desk: Insurance Verification",
   "required": 0,
   "summary": "Verify a patient's coverage before the appointment so there are no surprises at checkout.",
   "lessons": [
    {
     "title": "Verifying coverage before the visit",
     "body": "Verify coverage **before** the appointment, not at checkout. It prevents billing surprises for the patient and the office.",
     "key_points": [],
     "steps": [
      "Collect the insurance card details when the appointment is booked.",
      "Verify eligibility with the insurance company.",
      "Note the copay and any limits in the patient record.",
      "Tell the patient what they will owe before they arrive."
     ],
     "scenario": {
      "situation": "A patient arrives and says their insurance changed last month, but the card on file is the old one.",
      "response": "Collect the new card and re-verify before treatment (steps 1 and 2).",
      "why": "Coverage must be confirmed against the current plan."
     }
    }
   ],
   "questions": [
    {
     "prompt": "When should coverage be verified?",
     "options": [
      "Before the appointment",
      "At checkout",
      "After the claim is denied"
     ],
     "answer": 0,
     "explanation": "Verify before the visit.",
     "lesson": 1,
     "kind": "check"
    },
    {
     "prompt": "What do you note in the patient record?",
     "options": [
      "The copay and any limits",
      "Only the card number"
     ],
     "answer": 0,
     "explanation": "Copay and limits go in the record.",
     "lesson": 1,
     "kind": "final"
    },
    {
     "prompt": "The patient's insurance changed. What do you do?",
     "options": [
      "Use the old card",
      "Collect the new card and re-verify"
     ],
     "answer": 1,
     "explanation": "Re-verify against the current plan.",
     "lesson": 1,
     "kind": "final"
    }
   ]
  }
 ],
 "announcements": [
  {
   "title": "Welcome to the TeamTrain demo",
   "body": "This is a sample dental office with made-up staff. Try a lesson, answer a quick check, and ask a question in the search box.",
   "pinned": 1
  },
  {
   "title": "Please finish Handpiece Sterilization this week",
   "body": "It is required for everyone. It takes about 3 minutes.",
   "pinned": 0
  }
 ],
 "org": {
  "name": "Riverside Family Dental (Demo)",
  "industry": "Dental office"
 },
 "ownerName": "Dr. Maya Chen",
 "assistantName": "Alex Rivera",
 "fillerStaff": [
  "Jordan Lee",
  "Sam Patel",
  "Taylor Brooks",
  "Riley Nguyen"
 ],
 "progress": [
  {
   "who": "assistant",
   "lessons": [
    [
     0,
     0
    ]
   ],
   "attempts": []
  },
  {
   "who": 0,
   "lessons": [
    [
     0,
     0
    ],
    [
     0,
     1
    ],
    [
     1,
     0
    ],
    [
     1,
     1
    ]
   ],
   "attempts": [
    [
     0,
     4,
     4
    ],
    [
     1,
     4,
     4
    ]
   ]
  },
  {
   "who": 1,
   "lessons": [
    [
     0,
     0
    ],
    [
     0,
     1
    ],
    [
     1,
     0
    ]
   ],
   "attempts": [
    [
     0,
     3,
     4
    ]
   ]
  },
  {
   "who": 2,
   "lessons": [
    [
     0,
     0
    ]
   ],
   "attempts": []
  }
 ]
};
