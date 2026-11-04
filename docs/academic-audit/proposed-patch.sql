-- FinLit focused academic remediation (3 November 2026).
-- Aligns metadata with supplied PDFs; tunes repetitive copy and selected answer distractors.
-- Deliberately avoids schema changes, UI features, budget-tracker changes, or assessment scoring changes.
BEGIN;
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM public.assessment_attempts)
    OR EXISTS (SELECT 1 FROM public.lesson_progress) THEN
  RAISE EXCEPTION 'Academic content patch requires a new content version once real learner attempts or lesson progress exist. No changes applied.';
 END IF;
END;
$guard$;
CREATE TEMP TABLE finlit_academic_map (
 lesson_key text PRIMARY KEY,
 concept_title text NOT NULL,
 example_title text NOT NULL,
 summary_title text NOT NULL,
 practice_context text NOT NULL,
 source_key text NOT NULL,
 source_section text NOT NULL,
 source_printed_pages text NOT NULL,
 source_pdf_pages text NOT NULL
) ON COMMIT DROP;

INSERT INTO finlit_academic_map VALUES
('lesson-1-1', 'Earned, received and available income', 'Rent is due before promised support arrives', 'Know which money is available', 'Identify the money Mwila has actually received, then compare it with the accommodation payment due tomorrow. Do not count the promised transfer as cash already available.', 'council', 'Session 6: Exploring Options for Earning Money', '33–36', '39–42'),
('lesson-1-2', 'Priorities change with circumstances', 'Transport, coursework and an outing', 'Protect needs while recognising choices', 'Check which costs have immediate academic consequences, then decide what Natasha can afford with K180 before Friday.', 'council', 'Session 8: Know the Difference Between Needs and Wants', '40–42', '46–48'),
('lesson-1-3', 'Fixed, variable and occasional expenses', 'Small weekly purchases accumulate', 'Track the actual spending pattern', 'Add the lunches, minibus trips and printing costs rather than judging each payment in isolation.', 'council', 'Session 9: Control Spending', '43–46', '49–52'),
('lesson-1-4', 'Promises and shared financial obligations', 'A loan request before electricity is due', 'Respect committed money', 'Decide what Leya can offer without using money already agreed for the shared electricity bill tonight.', 'council', 'Session 15: Talking About Money', '67–70', '73–76'),
('lesson-2-1', 'A budget connects resources and costs', 'Chipo’s study costs and invitation', 'Use a budget before committing', 'Calculate the money left after essential costs, then check whether the optional event can fit without removing required expenses.', 'ilo', 'Session 7: Budget and Budgeting', '57–63', '66–72'),
('lesson-2-2', 'Confirmed funds and monthly allocations', 'A delayed family payment changes the plan', 'Budget by availability and due date', 'Plan Mutinta’s immediate K900 across the stated minimum needs; leave future expected support out until it arrives.', 'ilo', 'Session 7: Budget and Budgeting', '57–63', '66–72'),
('lesson-2-3', 'Expenses are not the same as transfers', 'Reconcile wallet, cash and fees', 'Count spending once', 'Identify the withdrawal as an own-money transfer, then add the service fee and actual purchases to find total expenses.', 'ilo', 'Session 7: Budget and Budgeting', '57–63', '66–72'),
('lesson-2-4', 'Respond to real budget variances', 'Transport and printing exceed the plan', 'Update the plan honestly', 'Compare the extra transport and printing costs with the K100 unspent leisure allocation; identify any remaining gap.', 'ilo', 'Session 7: Budget and Budgeting', '57–63', '66–72'),
('lesson-3-1', 'Saving depends on available resources', 'Crop-sale support arrives irregularly', 'Save realistically, without pressure', 'Compare Bupe’s essential commitments with money already received before deciding whether any saving is feasible this month.', 'council', 'Session 2: Why Save?', '16–21', '22–27'),
('lesson-3-2', 'Targets, time and realistic contributions', 'A study phone savings goal', 'Adjust goals to real capacity', 'Subtract Misozi’s existing savings from the phone cost and divide by the six remaining months. Check affordability separately.', 'council', 'Session 4: Make a Savings Plan', '26–29', '32–35'),
('lesson-3-3', 'Access matters when choosing where to save', 'Emergency travel before chilimba payout', 'Match saving method to purpose', 'Compare how quickly Ruth can access K300 through each method; account for the chilimba payout schedule and unknown fees.', 'council', 'Session 12: Save in a Safe Place', '55–57', '61–63'),
('lesson-3-4', 'Using and rebuilding emergency reserves', 'Unexpected travel without spending rent money', 'A setback calls for a revised plan', 'Work out how Kelvin can cover urgent travel from reserved and optional funds while protecting rent commitments.', 'council', 'Session 13: Dealing with Setbacks in Saving', '58–61', '64–67'),
('lesson-4-1', 'Gifts, loans and repayment promises', 'Clarify the terms before accepting help', 'Know what must be repaid', 'Distinguish the family gift, friend’s loan and informal lender offer; identify which terms Peter must clarify.', 'council', 'Session 14: Your Own Money vs. Someone Else’s Money', '62–66', '68–72'),
('lesson-4-2', 'Interest, fees and actual cost', 'Compare two fictional offers fairly', 'Calculate the full borrowing cost', 'Include the separate fee when calculating Offer A’s total borrowing cost, then compare it with Offer B.', 'ilo', 'Session 5: Equity or Debt Financing', '45–48', '54–57'),
('lesson-4-3', 'Repayment depends on timing and capacity', 'Debt is due before trading receipts', 'Test affordability before borrowing', 'Check which income is confirmed by the due date and how much remains after stock and essential living costs.', 'ilo', 'Session 5: Equity or Debt Financing', '45–48', '54–57'),
('lesson-4-4', 'Avoid debt cycling and communicate early', 'New borrowing may deepen old debt', 'Address the repayment gap', 'Compare Agness’s K150 repayment capacity with existing debts and the cost of the proposed replacement loan.', 'ilo', 'Session 8: Financial Negotiations', '64–67', '73–76'),
('lesson-5-1', 'Verify recipients before paying', 'Conflicting university payment instructions', 'Confirm first, pay second', 'Compare the conflicting instructions and identify an independently verified university contact before authorising payment.', 'finscope', 'Section 9.1: Money Transfer and Payment Services (local usage context)', '63–65', '75–77'),
('lesson-5-2', 'Reconcile fees, receipts and transfers', 'One own-money transfer appears twice', 'Record transfers without double-counting', 'Identify the K150 as movement between David’s accounts and count only the K4 fee and K90 purchase as expenses.', 'finscope', 'Section 9.1: Money Transfer and Payment Services (local usage context)', '63–65', '75–77'),
('lesson-5-3', 'Protect credentials and confirm claims', 'An OTP request follows a screenshot', 'Verify independently, never share codes', 'Decide what Bwalya should do before responding to a stranger claiming an accidental transfer. Do not treat a screenshot as proof.', 'oecd', 'Section 4.5: Scams and Fraud (competency framework)', '65–66', '65–66'),
('lesson-5-4', 'Document and escalate payment disputes', 'A debit without confirmed receipt', 'Keep evidence and use official channels', 'Identify the evidence Joseph needs and the appropriate provider-first complaint route without making a second blind payment.', 'boz', 'Customer Complaints Handling and Resolution Directives §19.2.1', '', ''),
('lesson-6-1', 'Plan for uncertainty after graduation', 'Prepare for costs without assuming a job offer', 'Separate goals from guarantees', 'Identify known graduation expenses, uncertain income and the costs Memory must plan for before receiving any wages.', 'ilo', 'Session 2: Financial Goals Setting', '24–27', '33–36'),
('lesson-6-2', 'Price changes reduce purchasing power', 'Five baskets cost more than before', 'Review targets as prices change', 'Compare the old and new cost of five identical baskets and calculate the additional money needed for the same quantity.', 'oecd', 'Section 1.2: Income, purchasing power and inflation (competency framework)', '20', '20'),
('lesson-6-3', 'Risk, return and access to capital', 'Registration funds face possible investment losses', 'Protect near-term essential money', 'Compare Zola’s possible investment outcomes with the deadline for paying registration costs. Consider loss and liquidity.', 'ilo', 'Session 6: Risk Management and Insurance', '49–56', '58–65'),
('lesson-6-4', 'Investigate investment claims and pressure', 'A no-risk promise and recruitment pressure', 'Check authorisation and terms', 'Identify the missing evidence behind the group’s promise before considering any payment or recruitment request.', 'sec', 'Public warning on unlicensed investment advisers, 21 February 2023', 'online', '');
UPDATE public.lessons l
SET structured_content = jsonb_set(
 jsonb_set(
  jsonb_set(l.structured_content,'{concept,title}',to_jsonb(m.concept_title),true),
  '{example,title}',to_jsonb(m.example_title),true),
 '{summaryTitle}',to_jsonb(m.summary_title),true)
FROM finlit_academic_map m
WHERE l.content_key=m.lesson_key AND l.is_published
 AND (l.structured_content #>> '{concept,title}')='Understand the decision';

UPDATE public.lessons l
SET structured_content=jsonb_set(l.structured_content,'{practice,context}',to_jsonb(m.practice_context),true)
FROM finlit_academic_map m
WHERE l.content_key=m.lesson_key AND l.is_published
 AND l.structured_content#>>'{practice,context}'='Use the information in the situation. Choose a response, then examine its consequences.';

CREATE TEMP TABLE finlit_academic_definition_details (
 lesson_key text PRIMARY KEY, details jsonb NOT NULL
) ON COMMIT DROP;
INSERT INTO finlit_academic_definition_details VALUES
('lesson-1-1', '["Tutoring payments are earned only once the work has been paid for.", "Mwila’s K400 from her aunt has already arrived.", "The promised K300 cannot yet be used for tomorrow’s rent."]'::jsonb),
('lesson-1-2', '["Assignment data can be essential when a submission is due tomorrow.", "The outing is the alternative Natasha gives up by funding transport and coursework."]'::jsonb),
('lesson-1-3', '["Chanda’s monthly accommodation contribution is broadly predictable.", "The number of lunches or trips can change between weeks.", "Printing is not necessarily needed every week."]'::jsonb),
('lesson-1-4', '["The K240 is reserved for electricity, not free for a personal loan.", "Explain the shared bill respectfully and discuss other ways to help."]'::jsonb),
('lesson-2-1', '["Only funds that can actually be used should support immediate decisions.", "Printing and transport need to appear in the same monthly plan.", "Subtract planned expenses before agreeing to another payment."]'::jsonb),
('lesson-2-2', '["Accommodation and food allocations are plans, not proof of cash received.", "The family transfer is expected later; the payment deadline is sooner."]'::jsonb),
('lesson-2-3', '["Tendai still owns K200 after moving it from wallet to cash.", "The withdrawal charge reduces her total funds even though the withdrawal does not.", "Compare the transaction record with cash and wallet balances together."]'::jsonb),
('lesson-2-4', '["Transport above its allocation creates a funding gap.", "An unspent leisure allocation can sometimes cover changed essential costs."]'::jsonb),
('lesson-3-1', '["A small reserve may support a later academic expense.", "With only K50 left after essentials, saving must remain realistic."]'::jsonb),
('lesson-3-2', '["Misozi’s remaining phone goal is K900 after existing savings.", "K900 over six months requires K150 per month, if feasible."]'::jsonb),
('lesson-3-3', '["A chilimba payout three months away does not meet tomorrow’s travel need.", "Members should understand contributions, payout timing and default arrangements."]'::jsonb),
('lesson-3-4', '["The urgent journey changes Kelvin’s expected spending.", "Restore savings only when later income and essential costs permit."]'::jsonb),
('lesson-4-1', '["Peter’s friend proposes a K100 loan, not a gift.", "Ask when and how much must be repaid before accepting the offer."]'::jsonb),
('lesson-4-2', '["The K50 difference between K500 received and K550 repaid is not the only charge.", "Offer A costs K70 in total after including the separate fee."]'::jsonb),
('lesson-4-3', '["Stock and living costs reduce money available to repay debt.", "A due date in two weeks does not align with hoped-for sales next month."]'::jsonb),
('lesson-4-4', '["Agness still owes K500 before considering the replacement offer.", "Borrowing K500 to repay K500 can worsen the gap if K650 is due next month."]'::jsonb),
('lesson-5-1', '["Confirm that the payment details belong to the university through an independent channel.", "Retain the provider’s transaction identifier after confirming the payment."]'::jsonb),
('lesson-5-2', '["Use a receipt alongside account records to check what actually happened.", "After the transfer, David’s combined funds decline only for the fee and purchase."]'::jsonb),
('lesson-5-3', '["The caller’s screenshot and urgency can be part of a deception.", "Do not share the OTP, even with a person claiming to reverse a transfer."]'::jsonb),
('lesson-5-4', '["Use the reference to follow up on the missing K180 payment.", "Check the provider’s published charges and complaint rules instead of guessing."]'::jsonb),
('lesson-6-1', '["Four months to graduation defines the immediate planning period.", "Prepare for delayed employment rather than assuming a salary start date."]'::jsonb),
('lesson-6-2', '["K500 no longer purchases five baskets after each price rises to K110.", "A single supply item’s price increase is not Zambia’s national inflation rate."]'::jsonb),
('lesson-6-3', '["The investment could rise to K720 or fall to K480 before registration.", "The possible loss matters because Zola needs the money soon.", "Splitting investment exposure does not make essential funds risk-free."]'::jsonb),
('lesson-6-4', '["A screenshot of a registration certificate is not sufficient independent verification.", "A claim to triple money without risk needs evidence, terms and a regulator check."]'::jsonb);
DO $defcheck$
BEGIN
 IF EXISTS (
 SELECT 1 FROM finlit_academic_definition_details d
 JOIN public.lessons l ON l.content_key=d.lesson_key
 WHERE jsonb_array_length(l.structured_content#>'{concept,definitions}') <> jsonb_array_length(d.details)
 ) THEN
  RAISE EXCEPTION 'Definition counts differ from audited content. No changes applied.';
 END IF;
END;
$defcheck$;

UPDATE public.lessons l
SET structured_content=jsonb_set(l.structured_content,'{concept,definitions}',
 (SELECT jsonb_agg(def.value||jsonb_build_object('detail',d.details->>(def.ordinality-1)) ORDER BY def.ordinality)
  FROM jsonb_array_elements(l.structured_content#>'{concept,definitions}') WITH ORDINALITY def(value,ordinality)),true)
FROM finlit_academic_definition_details d
WHERE l.content_key=d.lesson_key AND l.is_published;

UPDATE public.lessons l
SET structured_content=jsonb_set(l.structured_content,'{references}',(
 SELECT jsonb_agg(
  CASE
   WHEN ref.item->>'source'='nsfe' THEN
      ref.item || jsonb_build_object('title','National Strategy on Financial Education for Zambia 2019–2024 (NSFE II)',
       'year',2019,'location','§1.4, printed p.7; §2.2.2, printed pp.9–10',
       'pdfPages','19, 21–22','evidenceRole','policy alignment', 'locatorVerified',true)
   WHEN ref.item->>'source'=m.source_key THEN
      ref.item || jsonb_build_object('title',CASE m.source_key
       WHEN 'council' THEN 'Financial Education Curriculum for the Adolescent Girls Empowerment Program: Dream Big! Kwacha for Our Future'
       WHEN 'ilo' THEN 'Financial Education for Youth: Trainer’s Manual'
       WHEN 'finscope' THEN 'FinScope Zambia 2020 Survey Report'
       WHEN 'oecd' THEN 'EU/OECD Financial Competence Framework for Adults'
       WHEN 'boz' THEN 'Bank of Zambia Customer Complaints Handling and Resolution Directives'
       WHEN 'sec' THEN 'SEC Zambia Public Warning: Unlicensed Investment Advisers'
       END,
       'year',CASE m.source_key WHEN 'council' THEN 2013 WHEN 'ilo' THEN 2011 WHEN 'finscope' THEN 2020 WHEN 'oecd' THEN 2022 WHEN 'boz' THEN 2020 WHEN 'sec' THEN 2023 END,
       'location',m.source_section,'printedPages',NULLIF(NULLIF(m.source_printed_pages,'online'),''),
       'pdfPages',NULLIF(m.source_pdf_pages,''), 'url', CASE m.source_key WHEN 'boz' THEN 'https://www.boz.zm/BankofZambiaCustomerComplaintsHandlingandResolutionDirectives1.pdf' WHEN 'sec' THEN 'https://www.seczambia.org.zm/public-warning-unlicensed-investment-advisers/' ELSE NULL END, 'evidenceRole',
       CASE WHEN m.source_key IN ('finscope') THEN 'Zambian contextual evidence'
            WHEN m.source_key IN ('boz','sec') THEN 'regulatory source, refresh prior to publication'
            WHEN m.source_key='oecd' THEN 'financial competency framework'
            ELSE 'instructional reference adapted for Zambian university students' END,
       'locatorVerified',true)
   ELSE ref.item END ORDER BY ref.n)
 FROM jsonb_array_elements(l.structured_content->'references') WITH ORDINALITY AS ref(item,n)
),true)
FROM finlit_academic_map m
WHERE l.content_key=m.lesson_key AND l.is_published;

-- A separate summary survives even if a secondary source was not in the original references array.
UPDATE public.lessons l
SET structured_content = jsonb_set(l.structured_content,'{academicAudit}',
 jsonb_build_object('status','desk reviewed; external expert and student pilot pending',
  'coreSource',m.source_key,'coreSection',m.source_section,
  'corePrintedPages',NULLIF(NULLIF(m.source_printed_pages,'online'),''),'corePdfPages',NULLIF(m.source_pdf_pages,''),
  'policy','NSFE II §1.4 p.7; §2.2.2 pp.9–10',
  'scope','selected NSFE financial-education competencies, not comprehensive coverage',
  'duration','10 minutes is an intended estimate, not a measured completion time'),true)
FROM finlit_academic_map m WHERE l.content_key=m.lesson_key AND l.is_published;

UPDATE public.lessons l
SET revision=l.revision+1,
    structured_content=jsonb_set(l.structured_content,'{version}',to_jsonb(l.revision+1),true),
    updated_at=now()
FROM finlit_academic_map m WHERE l.content_key=m.lesson_key AND l.is_published;

CREATE TEMP TABLE finlit_revised_distractors (
 assessment_key text NOT NULL,
 question_order int NOT NULL,
 old_text text NOT NULL,
 new_text text NOT NULL,
 PRIMARY KEY(assessment_key,question_order,old_text)
) ON COMMIT DROP;
INSERT INTO finlit_revised_distractors VALUES
('diagnostic-v2', 3, 'Spend all K120 on data', 'Pay K70 for transport and K50 for the outing; defer assignment data until later'),
('diagnostic-v2', 3, 'Pay for the outing and assume more money will arrive', 'Pay K80 for the outing and K30 for data; rely on a friend to cover the transport'),
('diagnostic-v2', 6, 'Record the extra spending as income', 'Reduce next month’s transport allocation by K60 but leave this month’s records unchanged'),
('diagnostic-v2', 6, 'Ignore it because the original plan looked balanced', 'Keep this month’s original category total and add the K60 only as a note'),
('diagnostic-v2', 9, 'Pretend the missed contribution has been saved', 'Keep the original savings target and assume later support will cover the missed amount'),
('diagnostic-v2', 9, 'Borrow at any cost to keep the original savings target', 'Use a short-term loan to protect the savings deadline without checking its repayment terms'),
('diagnostic-v2', 15, 'Send money immediately without checking the transaction', 'Call the number the sender provides and follow its instructions for reversing the transfer'),
('diagnostic-v2', 15, 'Share the OTP if the caller knows your name', 'Share the OTP after the caller correctly identifies the supposed transfer amount'),
('diagnostic-v2', 18, 'Borrow to invest before the offer closes', 'Rely on testimonials in the same investment group before transferring the money'),
('diagnostic-v2', 18, 'Pay quickly because a guaranteed return removes risk', 'Send a smaller trial payment because the promise says the return is guaranteed'),
('final-v1', 3, 'Reserve all K150 for entertainment', 'Pay K90 for the celebration and put the remaining K60 towards the K120 required costs'),
('final-v1', 3, 'Attend the celebration and leave both obligations unpaid', 'Buy the materials first, attend the celebration, and assume transport can be paid later'),
('final-v1', 6, 'Keep every planned purchase without checking funds', 'Reduce next month’s food limit by K80 but leave the current month’s records unchanged'),
('final-v1', 6, 'Delete the food entries to restore the planned balance', 'Record only the planned food amount and leave the extra K80 out of the spending record'),
('final-v1', 9, 'Count the delayed support as cash already saved', 'Keep the original deadline and assume delayed support will replace the reserve without reviewing funds'),
('final-v1', 9, 'Choose an unaffordable loan only to preserve the original schedule', 'Take short-term credit to preserve the savings plan before comparing its charges and due date'),
('final-v1', 15, 'Forward the PIN to the sender for verification', 'Follow the link if the sender name resembles the provider’s brand'),
('final-v1', 15, 'Enter the PIN quickly to prevent blocking', 'Call the contact number in the message and ask whether the supplied link is genuine'),
('final-v1', 18, 'Treat the promoter’s confidence as evidence of safety', 'Treat positive comments in the promoter’s own group as sufficient evidence'),
('final-v1', 18, 'Invest essential rent money because losses are said to be impossible', 'Send a small trial payment to test returns before checking provider authorisation');
DO $distractorcheck$
DECLARE matched int;
BEGIN
 SELECT count(*) INTO matched
 FROM finlit_revised_distractors d
 JOIN public.assessments a ON a.content_key=d.assessment_key AND a.is_published
 JOIN public.assessment_questions q ON q.assessment_id=a.id AND q.sort_order=d.question_order
 JOIN public.assessment_options o ON o.question_id=q.id AND o.option_text=d.old_text
 JOIN public.assessment_answer_keys k ON k.question_id=q.id AND k.correct_option_id<>o.id;
 IF matched <> 20 THEN
   RAISE EXCEPTION 'Expected 20 original incorrect options, found %. Assessment bank changed; no changes applied.',matched;
 END IF;
END;
$distractorcheck$;

UPDATE public.assessment_options o SET option_text=d.new_text
FROM finlit_revised_distractors d
JOIN public.assessments a ON a.content_key=d.assessment_key AND a.is_published
JOIN public.assessment_questions q ON q.assessment_id=a.id AND q.sort_order=d.question_order
JOIN public.assessment_answer_keys k ON k.question_id=q.id
WHERE o.question_id=q.id AND o.option_text=d.old_text AND o.id<>k.correct_option_id;

UPDATE public.assessments a SET updated_at=now()
WHERE a.content_key IN ('diagnostic-v2','final-v1');
-- Postconditions: fail atomically rather than publish partially updated education content.
DO $verify$
DECLARE published_modules integer; published_lessons integer; checkpoint_total integer; remaining_old integer;
BEGIN
 SELECT count(*) INTO published_modules FROM public.modules WHERE is_published AND content_key IS NOT NULL;
 SELECT count(*) INTO published_lessons FROM public.lessons WHERE is_published AND content_key IS NOT NULL;
 SELECT coalesce(sum(jsonb_array_length(structured_content->'checkpoint')),0)
   INTO checkpoint_total FROM public.lessons WHERE is_published AND content_key IS NOT NULL;
 IF published_modules<>6 OR published_lessons<>24 OR checkpoint_total<>72 THEN
  RAISE EXCEPTION 'Unexpected published curriculum counts (% modules, % lessons, % checkpoints)',
     published_modules,published_lessons,checkpoint_total;
 END IF;
 IF EXISTS (SELECT 1 FROM public.lessons WHERE is_published AND content_key IS NOT NULL
            AND revision <> (structured_content->>'version')::integer) THEN
  RAISE EXCEPTION 'Lesson revision mismatch';
 END IF;
 SELECT count(*) INTO remaining_old FROM finlit_revised_distractors d
 JOIN public.assessments a ON a.content_key=d.assessment_key
 JOIN public.assessment_questions q ON q.assessment_id=a.id AND q.sort_order=d.question_order
 JOIN public.assessment_options o ON o.question_id=q.id AND o.option_text=d.old_text;
 IF remaining_old<>0 THEN
  RAISE EXCEPTION 'Some original distractors remain; rolling back';
 END IF;
END;
$verify$;
COMMIT;
