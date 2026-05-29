/**
 * ================================================================
 * FinRecon Pro — NBFC Finance Suite
 * ================================================================
 * File        : js/modules/data.js
 * Description : Central data store. Holds all sample / seed data
 *               for every module — bank recon entries, insurance
 *               recon rows, schedule definitions, dashboard feed,
 *               disbursal sample set. Exposed as a global AppData
 *               object consumed by all page modules.
 *
 *               Replace sample arrays with real API calls when
 *               connecting a backend.
 *
 * Author      : Jatin Mittal
 * Email       : jatin.mittal@cars24.com
 * Version     : 1.0.0
 * Created     : April 2024
 * ================================================================
 */

const AppData = {

  /* ── Bank Recon ── */
  bankRecon: {
    summary: {
      ledgerTotal:  '₹2,84,72,400',
      bankTotal:    '₹2,82,32,400',
      difference:   '₹2,40,000',
      matched:      '42 / 45',
    },
    entries: [
      { date:'10 Apr', ref:'TXN-001', narration:'Disbursal KA-2841',        ledger:'5,20,000',   bank:'5,20,000',   diff:'—',           status:'matched' },
      { date:'10 Apr', ref:'TXN-002', narration:'EMI Collection NEFT',      ledger:'1,24,000',   bank:'1,00,000',   diff:'-24,000',     status:'open' },
      { date:'10 Apr', ref:'TXN-003', narration:'Vendor Payment — GPS',     ledger:'38,000',     bank:'38,000',     diff:'—',           status:'matched' },
      { date:'10 Apr', ref:'TXN-004', narration:'Motor Ins. Premium',       ledger:'12,40,000',  bank:'—',          diff:'-12,40,000',  status:'open' },
      { date:'09 Apr', ref:'TXN-005', narration:'Disbursal MH-1920',        ledger:'3,80,000',   bank:'3,80,000',   diff:'—',           status:'matched' },
      { date:'09 Apr', ref:'TXN-006', narration:'Processing Fee receipt',   ledger:'4,500',      bank:'4,500',      diff:'—',           status:'matched' },
    ],
  },

  /* ── Motor Insurance Recon ── */
  motorRecon: {
    summary: { total:156, matched:153, unmatched:3, premium:'₹18,42,500', difference:'₹24,750' },
    entries: [
      { policy:'POL-MH-0038', customer:'Ramesh Kumar',  vehicle:'MH12AB1234', ours:'8,250',  insurer:'8,250',  diff:'0',       status:'matched' },
      { policy:'POL-MH-0039', customer:'Sunita Devi',   vehicle:'MH14CD5678', ours:'9,100',  insurer:'9,100',  diff:'0',       status:'matched' },
      { policy:'POL-MH-0040', customer:'Anil Sharma',   vehicle:'KA05EF9012', ours:'11,500', insurer:'8,250',  diff:'-3,250',  status:'open' },
      { policy:'POL-MH-0041', customer:'Priya Nair',    vehicle:'TN01GH3456', ours:'7,800',  insurer:'—',      diff:'-7,800',  status:'partial' },
      { policy:'POL-MH-0042', customer:'Vikram Singh',  vehicle:'DL03IJ7890', ours:'13,200', insurer:'13,200', diff:'0',       status:'matched' },
    ],
  },

  /* ── Loan Insurance Recon ── */
  loanInsRecon: {
    summary: { collected:'₹48,72,000', confirmed:'₹48,49,500', unreconciled:'₹22,500', policies:219 },
    entries: [
      { ref:'LI-GRP-00215', acc:'LAC-10842', customer:'Mohan Patel',   insurer:'LIC',        premium:'3,600',  confirmed:'3,600', status:'matched' },
      { ref:'LI-GRP-00216', acc:'LAC-10918', customer:'Fatima Shaikh', insurer:'HDFC Life',  premium:'4,200',  confirmed:'4,200', status:'matched' },
      { ref:'LI-GRP-00217', acc:'LAC-11042', customer:'Deepak Verma',  insurer:'LIC',        premium:'3,900',  confirmed:'—',     status:'open' },
      { ref:'LI-GRP-00218', acc:'LAC-11103', customer:'Geeta Rao',     insurer:'Bajaj Allianz', premium:'5,100', confirmed:'5,100', status:'matched' },
      { ref:'LI-GRP-00219', acc:'LAC-11250', customer:'Suresh Iyer',   insurer:'HDFC Life',  premium:'18,600', confirmed:'—',     status:'partial' },
    ],
  },

  /* ── Schedules ── */
  schedules: [
    {
      id: 'motor-schedule',
      name: 'Motor Insurance Schedule',
      desc: 'Premium collection, remittance & outstanding register per policy',
      accent: 'accent-navy',
      icon: '<path d="M8 1L2 4v4c0 3.31 2.69 6 6 7 3.31-1 6-3.69 6-7V4L8 1z" stroke="#E8B84B" stroke-width="1.3"/>',
      progress: 92,
      statusLabel: 'In progress',
      statusBadge: 'badge-amber',
      chips: [
        { val:'₹18,42,500', label:'Total Premium' },
        { val:'₹17,85,000', label:'Remitted' },
        { val:'₹57,500',    label:'Outstanding', cls:'negative' },
        { val:'156',        label:'Policies' },
        { val:'3',          label:'Insurers' },
      ],
      columns: ['Policy No.','Insurer','Customer','Vehicle No.','Premium (₹)','Remitted (₹)','Pending (₹)','Status'],
      rows: [
        ['POL-MH-0038','Bajaj Allianz','Ramesh Kumar','MH12AB1234','8,250','8,250','—','cleared'],
        ['POL-MH-0040','ICICI Lombard','Anil Sharma','KA05EF9012','11,500','8,250','3,250','partial'],
        ['POL-MH-0041','HDFC Ergo','Priya Nair','TN01GH3456','7,800','—','7,800','open'],
        ['POL-MH-0042','Bajaj Allianz','Vikram Singh','DL03IJ7890','13,200','13,200','—','cleared'],
      ],
    },
    {
      id: 'loan-ins-schedule',
      name: 'Loan Insurance Schedule',
      desc: 'Group & individual credit life premium register per insurer',
      accent: 'accent-gold',
      icon: '<rect x="2" y="3" width="12" height="10" rx="1.5" stroke="#E8B84B" stroke-width="1.3"/><path d="M5 7h6M5 10h4" stroke="#E8B84B" stroke-width="1.2" stroke-linecap="round"/>',
      progress: 78,
      statusLabel: 'In progress',
      statusBadge: 'badge-amber',
      chips: [
        { val:'₹48,72,000', label:'Premium Collected' },
        { val:'₹48,49,500', label:'Remitted' },
        { val:'₹22,500',    label:'Outstanding', cls:'negative' },
        { val:'219',        label:'Policies' },
      ],
      columns: ['Policy Ref','Loan A/c','Insurer','Sum Assured (₹)','Premium (₹)','Remitted (₹)','Pending','Status'],
      rows: [
        ['LI-GRP-00215','LAC-10842','LIC','3,00,000','3,600','3,600','—','cleared'],
        ['LI-GRP-00217','LAC-11042','LIC','2,50,000','3,900','—','3,900','open'],
        ['LI-GRP-00219','LAC-11250','HDFC Life','8,00,000','18,600','9,300','9,300','partial'],
      ],
    },
    {
      id: 'pocket-schedule',
      name: 'Pocket Insurance Schedule',
      desc: 'Add-on pocket insurance collection & remittance register',
      accent: 'accent-green',
      icon: '<rect x="3" y="2" width="10" height="12" rx="1.5" stroke="#E8B84B" stroke-width="1.3"/><path d="M6 6h4M6 9h2" stroke="#E8B84B" stroke-width="1.2" stroke-linecap="round"/>',
      progress: 85,
      statusLabel: 'In progress',
      statusBadge: 'badge-amber',
      chips: [
        { val:'₹3,12,500', label:'Premium Collected' },
        { val:'₹2,95,000', label:'Remitted' },
        { val:'₹17,500',   label:'Outstanding', cls:'negative' },
        { val:'89',        label:'Active Policies' },
      ],
      columns: ['Policy Ref','Customer','Product Type','Loan A/c','Premium (₹)','Remitted (₹)','Status'],
      rows: [
        ['PKT-00211','Shyam Lal','Hospital Cash','LAC-10901','1,800','1,800','cleared'],
        ['PKT-00212','Meena Joshi','Accidental Cover','LAC-11022','2,400','—','open'],
        ['PKT-00213','Ravi Desai','Life Micro','LAC-11145','1,200','1,200','cleared'],
      ],
    },
    {
      id: 'partmax-schedule',
      name: 'Partner Max Schedule',
      desc: 'Partner Max Life premium, commission & net remittance register',
      accent: 'accent-teal',
      icon: '<circle cx="8" cy="6" r="3" stroke="#E8B84B" stroke-width="1.3"/><path d="M3 14c0-2.76 2.24-5 5-5h0c2.76 0 5 2.24 5 5" stroke="#E8B84B" stroke-width="1.3" stroke-linecap="round"/>',
      progress: 65,
      statusLabel: 'In progress',
      statusBadge: 'badge-amber',
      chips: [
        { val:'₹6,84,000', label:'Premium Collected' },
        { val:'₹68,400',   label:'Commission Earned' },
        { val:'₹6,15,600', label:'Net Remittance' },
        { val:'47',        label:'Policies' },
      ],
      columns: ['Policy Ref','Customer','Loan A/c','Plan Type','Premium (₹)','Commission (₹)','Net Remit (₹)','Status'],
      rows: [
        ['PM-00841','Anjali Shah','LAC-10855','Term Plan','12,000','1,200','10,800','cleared'],
        ['PM-00842','Prakash Tiwari','LAC-11002','TROP','18,500','1,850','16,650','partial'],
        ['PM-00843','Kavita More','LAC-11188','Term Plan','9,600','960','8,640','cleared'],
      ],
    },
    {
      id: 'rto-schedule',
      name: 'RTO Schedule',
      desc: 'RTO charges collection, remittance & hypothecation register',
      accent: 'accent-purple',
      icon: '<rect x="2" y="9" width="12" height="5" rx="1" stroke="#E8B84B" stroke-width="1.3"/><circle cx="5" cy="11.5" r="1" fill="#E8B84B"/><circle cx="11" cy="11.5" r="1" fill="#E8B84B"/><path d="M3 9V6l2-3h6l2 3v3" stroke="#E8B84B" stroke-width="1.3" stroke-linejoin="round"/>',
      progress: 55,
      statusLabel: 'In progress',
      statusBadge: 'badge-amber',
      chips: [
        { val:'₹4,28,500', label:'RTO Collected' },
        { val:'₹4,10,000', label:'Remitted' },
        { val:'₹18,500',   label:'Outstanding', cls:'negative' },
        { val:'214',       label:'Vehicles' },
        { val:'198',       label:'Hypo. Filed' },
      ],
      columns: ['Loan A/c','Customer','Vehicle No.','RTO','Charges (₹)','Remitted (₹)','Hypo. Filed','Status'],
      rows: [
        ['LAC-10842','Mohan Patel','MH12AB1234','Pune RTO','2,500','2,500','Yes','cleared'],
        ['LAC-11042','Deepak Verma','KA05EF9012','Bangalore RTO','3,200','3,200','Pending','partial'],
        ['LAC-11250','Suresh Iyer','TN01GH3456','Chennai RTO','2,800','—','No','open'],
      ],
    },
    {
      id: 'float-register',
      name: 'Complete Float Register',
      desc: 'Unified float across all insurance & RTO buckets with ageing',
      accent: 'accent-coral',
      icon: '<path d="M2 12V6l6-4 6 4v6" stroke="#E8B84B" stroke-width="1.3" stroke-linecap="round"/><rect x="6" y="8" width="4" height="4" rx="0.5" stroke="#E8B84B" stroke-width="1.2"/>',
      progress: 40,
      statusLabel: 'Needs attention',
      statusBadge: 'badge-red',
      notice: { type:'danger', text:'Float balance increased by ₹1,05,000 vs last month. Review open items immediately.' },
      chips: [
        { val:'₹8,42,500', label:'Total Float' },
        { val:'₹3,15,000', label:'Motor Ins.', cls:'negative' },
        { val:'₹2,80,000', label:'Loan Ins.' },
        { val:'₹1,28,500', label:'Pocket Ins.' },
        { val:'₹1,19,000', label:'RTO Float' },
      ],
      columns: ['Float Ref','Category','Branch','Float Amt (₹)','Since Date','Days Open','Action Due','Status'],
      rows: [
        ['FLT-APR-01','Motor Ins.','Pune','57,500','01 Apr','10','Remit to insurer','open'],
        ['FLT-APR-02','Loan Ins.','Mumbai','77,000','03 Apr','8','Policy confirmation','partial'],
        ['FLT-APR-03','Pocket Ins.','Nashik','17,500','05 Apr','6','Remit to insurer','open'],
        ['FLT-APR-04','RTO','Aurangabad','18,500','06 Apr','5','File hypo at RTO','open'],
        ['FLT-APR-05','Partner Max','Pune','16,650','08 Apr','3','Net remittance','partial'],
      ],
    },
    {
      id: 'bajaj-colending',
      name: 'Bajaj Co-Lending',
      desc: 'Bajaj Finance co-lending portfolio — disbursals, collections, reconciliation & outstanding',
      accent: 'accent-gold',
      icon: '<rect x="1" y="5" width="14" height="9" rx="1.5" stroke="#E8B84B" stroke-width="1.3"/><path d="M4 5V4a4 4 0 0 1 8 0v1" stroke="#E8B84B" stroke-width="1.3"/><path d="M8 9v2M6 10h4" stroke="#E8B84B" stroke-width="1.2" stroke-linecap="round"/>',
      progress: 0,
      statusLabel: 'Not started',
      statusBadge: 'badge-amber',
      notice: { type:'info', text:'Bajaj Co-Lending schedule is under setup. Data upload and reconciliation module coming soon.' },
      chips: [
        { val: 'Coming Soon', label: 'Disbursal Recon' },
        { val: 'Coming Soon', label: 'Collection Recon' },
        { val: 'Coming Soon', label: 'Outstanding' },
        { val: 'Bajaj Finance', label: 'Partner' },
      ],
      columns: ['Loan A/c', 'Customer', 'Disbursed (₹)', 'CFSPL Share', 'Bajaj Share', 'EMI Due', 'Collected', 'Status'],
      rows: [],
    },
    {
      id: 'accrual-actual',
      name: 'Accrual vs Actualization',
      desc: 'Month-on-month accrued vs actual income across all schedule heads',
      accent: 'accent-slate',
      icon: '<path d="M2 13l4-5 3 2 3-4 4-3" stroke="#E8B84B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="8" r="1.5" fill="#E8B84B"/>',
      progress: 30,
      statusLabel: 'Draft',
      statusBadge: 'badge-amber',
      notice: { type:'warning', text:'Total variance of ₹1,84,400 identified. Resolve all heads before books close for April.' },
      chips: [
        { val:'₹81,39,500', label:'Total Accrued' },
        { val:'₹79,55,100', label:'Total Actualized' },
        { val:'₹1,84,400',  label:'Total Variance', cls:'negative' },
        { val:'5',          label:'Schedule Heads' },
      ],
      columns: ['Schedule Head','Accrued (₹)','Actualized (₹)','Variance (₹)','Variance %','Status'],
      rows: [
        ['Motor Insurance','18,42,500','17,85,000','57,500','3.12%','open'],
        ['Loan Insurance','48,72,000','48,49,500','22,500','0.46%','partial'],
        ['Pocket Insurance','3,12,500','2,95,000','17,500','5.60%','open'],
        ['Partner Max','6,84,000','6,15,600','68,400','10.00%','partial'],
        ['RTO Charges','4,28,500','4,10,000','18,500','4.32%','open'],
      ],
    },
  ],

  /* ── Dashboard pending items ── */
  dashboardPending: [
    { item: 'Bajaj Co-Lending Setup', due: 'Schedule module pending setup', priority: 'High' },
    { module:'Bank Recon',   ref:'TXN-20240411-04', amount:'₹12,40,000', date:'10 Apr', status:'open' },
    { module:'Motor Ins.',   ref:'POL-MH-0041',     amount:'₹8,250',     date:'09 Apr', status:'partial' },
    { module:'Loan Ins.',    ref:'LI-GRP-00219',    amount:'₹22,500',    date:'08 Apr', status:'partial' },
    { module:'Bank Recon',   ref:'TXN-20240411-07', amount:'₹3,80,000',  date:'10 Apr', status:'open' },
    { module:'Float Reg.',   ref:'FLT-APR-08',      amount:'₹1,05,000',  date:'08 Apr', status:'open' },
  ],

  /* ── Dashboard activity feed ── */
  activity: [
    { text:'Bank statement Apr 10 uploaded',                  time:'Today, 9:42 AM',       dot:'gold' },
    { text:'Motor recon — 142 policies matched',              time:'Today, 9:15 AM',        dot:'gold' },
    { text:'RTO schedule Mar exported',                       time:'Yesterday, 6:30 PM',   dot:'gold' },
    { text:'Float register: 2 unreconciled entries',          time:'Yesterday, 4:00 PM',   dot:'red' },
    { text:'Accrual vs Actual Apr draft saved',               time:'Yesterday, 2:30 PM',   dot:'gold' },
  ],

  /* ── Disbursal sample (used when no file uploaded) ── */
  disbursalSample: [
    { date:'01 Apr', acc:'LAC-10901', customer:'Shyam Lal',       branch:'Pune',        amount:520000,  product:'Two Wheeler', status:'Disbursed' },
    { date:'02 Apr', acc:'LAC-10902', customer:'Meena Joshi',      branch:'Mumbai',      amount:850000,  product:'Car Loan',    status:'Disbursed' },
    { date:'03 Apr', acc:'LAC-10903', customer:'Ravi Desai',       branch:'Nashik',      amount:320000,  product:'Two Wheeler', status:'Disbursed' },
    { date:'04 Apr', acc:'LAC-10904', customer:'Anjali Shah',      branch:'Pune',        amount:1200000, product:'Car Loan',    status:'Disbursed' },
    { date:'05 Apr', acc:'LAC-10905', customer:'Prakash Tiwari',   branch:'Aurangabad',  amount:420000,  product:'Two Wheeler', status:'Pending' },
    { date:'06 Apr', acc:'LAC-10906', customer:'Kavita More',      branch:'Mumbai',      amount:750000,  product:'Car Loan',    status:'Disbursed' },
    { date:'07 Apr', acc:'LAC-10907', customer:'Suresh Iyer',      branch:'Pune',        amount:980000,  product:'Car Loan',    status:'Disbursed' },
    { date:'08 Apr', acc:'LAC-10908', customer:'Nisha Gupta',      branch:'Nashik',      amount:480000,  product:'Two Wheeler', status:'Disbursed' },
    { date:'09 Apr', acc:'LAC-10909', customer:'Rajesh Yadav',     branch:'Pune',        amount:1100000, product:'Car Loan',    status:'Disbursed' },
    { date:'10 Apr', acc:'LAC-10910', customer:'Pooja Verma',      branch:'Mumbai',      amount:640000,  product:'Two Wheeler', status:'Disbursed' },
  ],
};