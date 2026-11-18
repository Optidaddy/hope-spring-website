const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
if($('#year')) $('#year').textContent = new Date().getFullYear();

// Theme toggle (dark is the default).
const themeToggle=$('#themeToggle');
function applyTheme(theme){document.body.dataset.theme=theme;const light=theme==='light';if(themeToggle){themeToggle.textContent=light?'☾ Dark':'☀ Light';themeToggle.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');}const meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=light?'#F5F7F4':'#090D0C';try{localStorage.setItem('hopeSpringTheme',theme)}catch(e){}}
let savedTheme='dark';try{savedTheme=localStorage.getItem('hopeSpringTheme')||'dark'}catch(e){}applyTheme(savedTheme);if(themeToggle)themeToggle.addEventListener('click',()=>applyTheme(document.body.dataset.theme==='dark'?'light':'dark'));

// Mobile navigation
const menuToggle = $('#menuToggle'), mainNav = $('#mainNav');
if(menuToggle&&mainNav)menuToggle.addEventListener('click', () => { const open=mainNav.classList.toggle('open'); menuToggle.setAttribute('aria-expanded',String(open)); menuToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation'); });
if(mainNav)$$('#mainNav a').forEach(a=>a.addEventListener('click',()=>{mainNav.classList.remove('open');if(menuToggle)menuToggle.setAttribute('aria-expanded','false')}));

// Accessible modal helpers
function openModal(el){el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';const focusable=el.querySelector('input,button,select');if(focusable)focusable.focus()}
function closeModal(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');document.body.style.overflow=''}
const donationModal=$('#donationModal'), donationForm=$('#donationForm'), paymentState=$('#paymentState');
function launchDonation(program){if(!donationModal||!donationForm||!paymentState)return;if(program&&$('#programSelect'))$('#programSelect').value=program;donationForm.hidden=false;paymentState.hidden=true;openModal(donationModal)}
$$('.donate-trigger').forEach(b=>b.addEventListener('click',()=>launchDonation()));
$$('.program-donate').forEach(b=>b.addEventListener('click',()=>launchDonation(b.dataset.program)));
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.closest('.modal-backdrop'))));
$$('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeModal(backdrop)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape') $$('.modal-backdrop.open').forEach(closeModal)});
let chosenAmount=1000;
$$('[data-amount]').forEach(b=>b.addEventListener('click',()=>{$$('[data-amount]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');chosenAmount=Number(b.dataset.amount);$('#customAmount').value=''}));
if($('#customAmount'))$('#customAmount').addEventListener('input',()=>{$$('[data-amount]').forEach(x=>x.classList.remove('selected'))});
function normalizePhone(value){let p=value.replace(/[\s-]/g,'');if(p.startsWith('+'))p=p.slice(1);if(p.startsWith('0'))p='254'+p.slice(1);return p}
function showPaymentState(icon,title,message,receipt=''){donationForm.hidden=true;paymentState.hidden=false;$('#stateIcon').textContent=icon;$('#stateTitle').textContent=title;$('#stateText').textContent=message;const r=$('#receipt');r.hidden=!receipt;r.textContent=receipt}
if($('#doneButton'))$('#doneButton').addEventListener('click',()=>closeModal(donationModal));
if(donationForm)donationForm.addEventListener('submit',async e=>{
 e.preventDefault();const amount=Number($('#customAmount').value||chosenAmount);const phone=normalizePhone($('#donorPhone').value);const program=$('#programSelect').value;
 if(!Number.isInteger(amount)||amount<10||amount>250000){alert('Enter a donation amount between KES 10 and KES 250,000.');return}
 if(!/^2547\d{8}$/.test(phone)){alert('Enter a valid Kenyan Safaricom-style mobile number, e.g. 0712345678 or 254712345678.');$('#donorPhone').focus();return}
 $('#donateSubmit').disabled=true;showPaymentState('…','Preparing your donation','Please wait while we securely prepare your payment request.');
 try{
   const response=await fetch('/api/mpesa/stkpush',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,phone,program,accountReference:'HopeSpring',transactionDesc:`Donation - ${program}`})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not start M-Pesa payment.');
   $('#stateIcon').textContent='⌁';$('#stateTitle').textContent='STK prompt sent — awaiting payment';$('#stateText').textContent=`Check ${phone} and enter your M-Pesa PIN on your phone to complete the donation. Do not share your PIN.`;$('#receipt').hidden=false;$('#receipt').textContent=`PAYMENT REQUEST\nAmount: KES ${amount.toLocaleString('en-KE')}\nProgramme: ${program}\nCheckout request: ${data.CheckoutRequestID||'Submitted'}\nStatus: Awaiting M-Pesa confirmation`;pollPayment(data.CheckoutRequestID,amount,program,phone);
 }catch(err){showPaymentState('!','Payment could not start',err.message)}finally{$('#donateSubmit').disabled=false}
});
async function pollPayment(checkoutId,amount,program,phone){if(!checkoutId)return;let tries=0;const timer=setInterval(async()=>{tries++;try{const r=await fetch(`/api/mpesa/status/${encodeURIComponent(checkoutId)}`);if(r.ok){const d=await r.json();if(d.status==='confirmed'){clearInterval(timer);$('#stateIcon').textContent='✓';$('#stateTitle').textContent='Donation confirmed';$('#stateText').textContent='Safaricom has confirmed your payment. Thank you.';$('#receipt').textContent=`HOPE SPRING PAYMENT RECEIPT\nM-Pesa receipt: ${d.receipt||'Confirmed'}\nAmount: KES ${amount.toLocaleString('en-KE')}\nProgramme: ${program}\nPhone: ${phone}\nStatus: CONFIRMED`;}else if(d.status==='failed'){clearInterval(timer);$('#stateIcon').textContent='×';$('#stateTitle').textContent='Payment not completed';$('#stateText').textContent=d.resultDescription||'Safaricom did not complete this payment.';}}}catch{}if(tries>=24)clearInterval(timer)},5000)}

// Stories
$$('.story-open').forEach(b=>b.addEventListener('click',()=>{if($('#storyModalTitle')&&$('#storyModalCopy')){$('#storyModalTitle').textContent=b.dataset.title;$('#storyModalCopy').textContent=b.dataset.copy;openModal($('#storyModal'))}}));
// Newsletter demo capture; connect to a mailing-list provider before launch.
if($('#newsletterForm'))$('#newsletterForm').addEventListener('submit',e=>{e.preventDefault();$('#newsletterMessage').textContent='Thank you for your interest! Newsletter delivery will be enabled when a mailing-list service is connected.';$('#newsletterEmail').value=''});
if($('#contactForm'))$('#contactForm').addEventListener('submit',e=>{e.preventDefault();const n=$('#contactName').value.trim(),em=$('#contactEmail').value.trim(),m=$('#contactMessage').value.trim();location.href=`mailto:meshlinksolutions@gmail.com?subject=${encodeURIComponent('Hope Spring website enquiry from '+n)}&body=${encodeURIComponent(m+'\n\nReply to: '+em)}`});

// Upendo assistant: curated answers, not a connected generative AI service.
const chatPanel=$('#chatPanel'),chatMessages=$('#chatMessages');
function toggleChat(open){if(!chatPanel)return;chatPanel.classList.toggle('open',open);chatPanel.setAttribute('aria-hidden',String(!open));if(open&&$('#chatInput'))$('#chatInput').focus()}
if($('#chatLauncher'))$('#chatLauncher').addEventListener('click',()=>toggleChat(!chatPanel.classList.contains('open')));if($('#chatClose'))$('#chatClose').addEventListener('click',()=>toggleChat(false));
function addMessage(text,who='bot'){const div=document.createElement('div');div.className=`message ${who}`;div.textContent=text;chatMessages.appendChild(div);chatMessages.scrollTop=chatMessages.scrollHeight}
function answerFor(q){const s=q.toLowerCase();if(/donat|mpesa|m-pesa|give|contribut/.test(s))return {text:'You can donate using M-Pesa: choose an amount, select a programme, enter your Safaricom number and follow the STK prompt on your phone. The donation form sends a request to the configured Safaricom Daraja environment; sandbox and production are separate environments.',donate:true};if(/program|school|water|health|scholar/.test(s))return {text:'Our featured focus areas are Education & Literacy, Clean Water & Nutrition, and Healthcare & Mentorship. Each programme is designed with community priorities in mind.'};if(/volunteer|help out|join/.test(s))return {text:'We would love to hear from you! Email meshlinksolutions@gmail.com with your interests, skills and availability. Our team can share current opportunities.'};if(/fund|transparent|money|where.*go/.test(s))return {text:'We aim to direct support toward community-led programmes and share clear updates about goals, spending and progress. Please consult the organisation’s verified financial reports for audited figures.'};if(/mission|about|who are/.test(s))return {text:'Hope Spring works alongside communities to widen access to education, safe water, nutrition and healthcare. We believe local people should help shape the solutions that affect their futures.'};return {text:'Thanks for asking! I can help with donations, our programmes, volunteering and how we approach transparency. You can also email meshlinksolutions@gmail.com for more details.'}}
function sendChat(q){if(!q.trim())return;addMessage(q,'user');const a=answerFor(q);setTimeout(()=>{addMessage(a.text);if(a.donate){const b=document.createElement('button');b.className='text-link';b.textContent='Open donation form →';b.addEventListener('click',()=>launchDonation());chatMessages.appendChild(b);chatMessages.scrollTop=chatMessages.scrollHeight}},250)}
if($('#chatForm'))$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#chatInput');sendChat(input.value);input.value=''});
$$('.quick-replies button').forEach(b=>b.addEventListener('click',()=>sendChat(b.textContent)));

