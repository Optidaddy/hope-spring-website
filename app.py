import os, re, base64, sqlite3
from datetime import datetime
from pathlib import Path
import requests
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / '.env')
app = Flask(__name__, static_folder='public', static_url_path='')
DB = BASE / 'payments.sqlite3'

def db():
    conn = sqlite3.connect(DB); conn.row_factory = sqlite3.Row
    conn.execute('''CREATE TABLE IF NOT EXISTS payments (checkout_id TEXT PRIMARY KEY, merchant_id TEXT, status TEXT NOT NULL, amount INTEGER, phone TEXT, program TEXT, receipt TEXT, result_description TEXT, created_at TEXT NOT NULL, transaction_date TEXT)''')
    return conn

def normalize_phone(value):
    p = re.sub(r'[\s-]', '', str(value or '')).lstrip('+')
    if p.startswith('0'): p = '254' + p[1:]
    return p

def config():
    keys = ['DARAJA_CONSUMER_KEY','DARAJA_CONSUMER_SECRET','DARAJA_SHORTCODE','DARAJA_PASSKEY','CALLBACK_URL']
    missing = [k for k in keys if not os.getenv(k)]
    if missing: raise ValueError('Missing Daraja configuration: ' + ', '.join(missing))
    if not os.getenv('CALLBACK_URL','').startswith('https://'): raise ValueError('CALLBACK_URL must be a public HTTPS URL.')

def base_url(): return 'https://api.safaricom.co.ke' if os.getenv('DARAJA_ENV') == 'production' else 'https://sandbox.safaricom.co.ke'

def token():
    r = requests.get(base_url() + '/oauth/v1/generate?grant_type=client_credentials', auth=(os.environ['DARAJA_CONSUMER_KEY'], os.environ['DARAJA_CONSUMER_SECRET']), timeout=25)
    data = r.json(); r.raise_for_status()
    if 'access_token' not in data: raise RuntimeError(data.get('errorMessage','Daraja OAuth failed'))
    return data['access_token']

@app.get('/')
def home(): return send_from_directory('public','index.html')
@app.get('/<path:name>')
def pages(name):
    candidate = BASE / 'public' / name
    if candidate.is_file(): return send_from_directory('public',name)
    return send_from_directory('public','index.html')
@app.get('/api/health')
def health(): return jsonify(ok=True, paymentMode=os.getenv('DARAJA_ENV','sandbox'))
@app.post('/api/mpesa/stkpush')
def stkpush():
    try:
        config(); data=request.get_json(force=True); amount=data.get('amount'); phone=normalize_phone(data.get('phone'))
        if not isinstance(amount,int) or amount < 1 or amount > 250000: return jsonify(error='Amount must be a whole number between KES 1 and KES 250,000.'),400
        if not re.fullmatch(r'2547\d{8}',phone): return jsonify(error='Enter a valid Kenyan mobile number.'),400
        shortcode=os.environ['DARAJA_SHORTCODE']; stamp=datetime.now().strftime('%Y%m%d%H%M%S')
        password=base64.b64encode(f"{shortcode}{os.environ['DARAJA_PASSKEY']}{stamp}".encode()).decode()
        payload={'BusinessShortCode':shortcode,'Password':password,'Timestamp':stamp,'TransactionType':os.getenv('DARAJA_TRANSACTION_TYPE','CustomerPayBillOnline'),'Amount':amount,'PartyA':phone,'PartyB':shortcode,'PhoneNumber':phone,'CallBackURL':os.environ['CALLBACK_URL'],'AccountReference':re.sub(r'[^A-Za-z0-9]','',str(data.get('accountReference','HopeSpring')))[:12],'TransactionDesc':str(data.get('transactionDesc','Donation'))[:13]}
        r=requests.post(base_url()+'/mpesa/stkpush/v1/processrequest',headers={'Authorization':'Bearer '+token()},json=payload,timeout=30); result=r.json()
        if not r.ok or result.get('ResponseCode')!='0': return jsonify(error=result.get('errorMessage') or result.get('ResponseDescription') or 'Safaricom did not accept the STK request.'),502
        with db() as conn: conn.execute('INSERT OR REPLACE INTO payments(checkout_id,merchant_id,status,amount,phone,program,created_at) VALUES(?,?,?,?,?,?,?)',(result['CheckoutRequestID'],result.get('MerchantRequestID'),'pending',amount,phone,str(data.get('program','General Fund'))[:40],datetime.utcnow().isoformat()))
        return jsonify(result),202
    except Exception as e:
        app.logger.exception('STK push error'); return jsonify(error=str(e)),500

@app.post('/api/mpesa/callback')
def callback():
    body=(request.get_json(silent=True) or {}).get('Body',{}).get('stkCallback')
    if not body: return jsonify(ResultCode=1,ResultDesc='Invalid callback payload'),400
    checkout=body.get('CheckoutRequestID'); code=int(body.get('ResultCode',1)); items=(body.get('CallbackMetadata') or {}).get('Item',[]); meta={x.get('Name'):x.get('Value') for x in items}
    with db() as conn:
        old=conn.execute('SELECT * FROM payments WHERE checkout_id=?',(checkout,)).fetchone()
        if not old: return jsonify(ResultCode=0,ResultDesc='Callback received; unmatched request logged'),200
        if code==0:
            conn.execute('UPDATE payments SET status=?,receipt=?,amount=COALESCE(?,amount),phone=COALESCE(?,phone),transaction_date=? WHERE checkout_id=?',('confirmed',meta.get('MpesaReceiptNumber'),meta.get('Amount'),str(meta.get('PhoneNumber')) if meta.get('PhoneNumber') else None,str(meta.get('TransactionDate') or ''),checkout))
        else: conn.execute('UPDATE payments SET status=?,result_description=? WHERE checkout_id=?',('failed',str(body.get('ResultDesc','Payment failed')),checkout))
    app.logger.info('Daraja callback processed for %s',checkout)
    return jsonify(ResultCode=0,ResultDesc='Accepted')

@app.get('/api/mpesa/status/<checkout_id>')
def status(checkout_id):
    with db() as conn: row=conn.execute('SELECT * FROM payments WHERE checkout_id=?',(checkout_id,)).fetchone()
    if not row: return jsonify(error='Payment request not found'),404
    return jsonify(dict(row))

if __name__=='__main__':
    app.run(host='0.0.0.0',port=int(os.getenv('PORT','3000')),debug=False)
