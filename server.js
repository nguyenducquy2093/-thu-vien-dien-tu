const express = require('express');
const multer = require('multer');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BOOKS_FILE = path.join(DATA_DIR, 'books.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const COVER_DIR = path.join(__dirname, 'covers');
const USE_CLOUDINARY = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const CLOUDINARY_META_FOLDER = 'thu-vien-dien-tu';

if (USE_CLOUDINARY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary configured');
}

[DATA_DIR, UPLOAD_DIR, COVER_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

function loadJSON(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8'); }

async function downloadJSONFromCloudinary(name) {
  if (!USE_CLOUDINARY) return null;
  try {
    const result = await cloudinary.api.resource(`${CLOUDINARY_META_FOLDER}/${name}`, { resource_type: 'raw' });
    const resp = await fetch(result.secure_url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function uploadJSONToCloudinary(data, name) {
  if (!USE_CLOUDINARY) return;
  try {
    const buf = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: `${CLOUDINARY_META_FOLDER}/${name}`, resource_type: 'raw', overwrite: true },
        (err, result) => { if (err) reject(err); else resolve(result); }
      );
      stream.end(buf);
    });
  } catch (e) { console.error('Cloudinary meta upload failed:', e.message); }
}

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'cover') {
      const ok = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(path.extname(file.originalname).toLowerCase());
      return cb(null, ok);
    }
    const ok = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.xls', '.xlsx', '.epub', '.html'].includes(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  }
});

async function uploadToCloudinary(buffer, folder, resourceType) {
  if (!USE_CLOUDINARY) return null;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType || 'auto', access_mode: 'public' },
      (err, result) => { if (err) reject(err); else resolve(result); }
    );
    stream.end(buffer);
  });
}

async function destroyFromCloudinary(publicId) {
  if (!USE_CLOUDINARY || !publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }); } catch {}
  try { await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }); } catch {}
}

const SEED_BOOKS = [
  {id:1,title:'Nhà Giả Kim',author:'Paulo Coelho',category:'Văn học',docType:'Sách điện tử',cover:'',rating:5,featured:true,description:'Hành trình tìm kiếm kho báu của chàng trai chăn cừu.',type:'inline',pages:['Nhà Giả Kim - cuốn sách bán chạy nhất mọi thời đại.','Chàng trai trẻ Santiago, một người chăn cừu ở vùng Andalusia, luôn mơ thấy một giấc mơ về kho báu ở Kim Tự Tháp Ai Cập.','Santiago lên đường tới châu Phi, bán đàn cừu của mình để thực hiện hành trình tìm kiếm kho báu.','Trên đường đi, anh gặp một người đàn ông bí ẩn tự xưng là Vua Melchizedek.','"Khi bạn khao khát một điều gì đó, cả vũ trụ sẽ hợp lực giúp bạn đạt được điều đó."','Santiago gặp một nhà giả kim trên sa mạc Sahara, người dạy anh lắng nghe trái tim.','Cuối cùng, Santiago nhận ra kho báu thực sự không phải là vàng bạc, mà là hành trình và những bài học.','Cuốn sách là một câu chuyện ngụ ngôn đầy cảm hứng về việc theo đuổi ước mơ.'],createdAt:'2024-01-01'},
  {id:2,title:'1984',author:'George Orwell',category:'Kinh điển',docType:'Sách điện tử',cover:'',rating:5,featured:true,description:'Tiểu thuyết dystopia về chế độ toàn trị.',type:'inline',pages:['Phát hành năm 1949, "1984" là một trong những tiểu thuyết dystopia nổi tiếng nhất.','Câu chuyện diễn ra tại London, thuộc siêu cường quốc Oceania dưới chế độ độc tài toàn trị.','Nhân vật chính Winston Smith làm việc tại Bộ Sự thật, viết lại lịch sử theo ý Đảng.','"Big Brother" - Anh Cả - luôn dõi theo mọi người qua các màn hình.','Winston bắt đầu mối tình bí mật với Julia, cùng nhau chống lại sự kiểm soát của Đảng.','Họ bị bắt bởi Cảnh sát Tư tưởng và tra tấn bởi O\'Brien.','Winston bị tra tấn đến mức thay đổi tư duy, cuối cùng anh thực sự yêu Big Brother.','Cuốn sách cảnh báo về hiểm họa của chủ nghĩa toàn trị, kiểm soát thông tin và xóa bỏ sự thật.'],createdAt:'2024-01-02'},
  {id:3,title:'Đắc Nhân Tâm',author:'Dale Carnegie',category:'Self-help',docType:'Sách điện tử',cover:'',rating:5,featured:true,description:'Nghệ thuật thu phục lòng người và giao tiếp hiệu quả.',type:'inline',pages:['"Đắc Nhân Tâm" - How to Win Friends and Influence People - cuốn sách self-help bán chạy nhất thế giới.','Nguyên tắc 1: Không chỉ trích, lên án hay phàn nàn. Thay vào đó, hãy cố gắng thấu hiểu.','Nguyên tắc 2: Thành thật khen ngợi và đánh giá cao người khác một cách chân thành.','Nguyên tắc 3: Khơi gợi lòng ham muốn ở người khác - hãy nghĩ xem họ muốn gì.','Hãy mỉm cười - nụ cười là cách đơn giản nhất để tạo thiện cảm với người đối diện.','Hãy nhớ tên người khác và gọi tên họ - đó là âm thanh ngọt ngào nhất trong bất kỳ ngôn ngữ nào.','Hãy lắng nghe nhiều hơn nói, khuyến khích người khác nói về bản thân họ.','Hãy nói về sở thích của người khác và làm cho họ cảm thấy mình quan trọng.'],createdAt:'2024-01-03'},
  {id:4,title:'Tam Quốc Diễn Nghĩa',author:'La Quán Trung',category:'Lịch sử',docType:'Sách điện tử',cover:'',rating:5,featured:false,description:'Tiểu thuyết lịch sử nổi tiếng về thời kỳ Tam Quốc.',type:'inline',pages:['Tam Quốc Diễn Nghĩa là tiểu thuyết lịch sử nổi tiếng nhất của văn học Trung Hoa.','Mở đầu với cảnh Lưu Bị, Quan Vũ và Trương Phi kết nghĩa vườn đào.','Tào Tháo - anh hùng hào kiệt nhưng đa nghi, nổi tiếng với câu "Ninh phụ thiên hạ nhân".','Gia Cát Lượng - quân sư thiên tài với những kế sách thần kỳ.','Trận Xích Bích là một trong những trận thủy chiến vĩ đại nhất lịch sử.','Tam Quốc diễn ra từ năm 184 đến 280, gần 100 năm hỗn loạn và chia cắt.','Tác phẩm khắc họa sâu sắc chiến tranh, ngoại giao, lòng trung thành và sự phản bội.','Tam Quốc Diễn Nghĩa đã ảnh hưởng sâu sắc đến văn hóa và tư duy chiến lược châu Á.'],createdAt:'2024-01-04'},
  {id:5,title:'Sapiens: Lược Sử Loài Người',author:'Yuval Noah Harari',category:'Khoa học',docType:'Sách điện tử',cover:'',rating:5,featured:true,description:'Lịch sử 200.000 năm của loài người.',type:'inline',pages:['Sapiens kể về lịch sử 200.000 năm của loài người từ khi xuất hiện ở châu Phi.','Cuộc Cách mạng Nhận thức (70.000 năm trước): Sapiens phát triển ngôn ngữ và khả năng hợp tác.','Cuộc Cách mạng Nông nghiệp (10.000 năm trước): Con người thuần hóa cây trồng và động vật.','Cuộc Cách mạng Khoa học (500 năm trước): Con người thừa nhận sự thiếu hiểu biết.','Harari cho rằng loài người thống trị thế giới nhờ khả năng tin vào những câu chuyện hư cấu.','Sách bán được hơn 16 triệu bản và được dịch ra hơn 60 thứ tiếng trên thế giới.','Harari đặt ra câu hỏi: Liệu con người có hạnh phúc hơn khi nền văn minh phát triển?','Cuốn sách kết thúc với câu hỏi về tương lai của Homo sapiens trong thời đại AI.'],createdAt:'2024-01-05'},
  {id:6,title:'Phân Tích Dữ Liệu Lớn',author:'Nguyễn Văn Khoa',category:'Khoa học',docType:'Bài báo khoa học',cover:'',rating:4,featured:false,description:'Nghiên cứu về phương pháp xử lý big data.',type:'inline',pages:['Bài báo nghiên cứu về phân tích dữ liệu lớn trong kỷ nguyên số.','Dữ liệu lớn (Big Data) được định nghĩa bởi 4V: Volume, Velocity, Variety, Veracity.','Các công cụ phổ biến: Hadoop, Spark, và các hệ thống NoSQL.','Phương pháp luận: thu thập, lưu trữ, xử lý và trực quan hóa dữ liệu.','Kết quả thực nghiệm cho thấy hiệu suất vượt trội so với phương pháp truyền thống.','Ứng dụng trong y tế, tài chính và giáo dục.','Thách thức: bảo mật dữ liệu và quyền riêng tư.','Kết luận: Big Data là xu hướng tất yếu của công nghệ hiện đại.'],createdAt:'2024-02-15'},
  {id:7,title:'Học Máy Trong Y Học',author:'Trần Thị Lan',category:'Khoa học',docType:'Bài báo khoa học',cover:'',rating:4,featured:false,description:'Ứng dụng học máy trong chẩn đoán bệnh.',type:'inline',pages:['Bài báo về ứng dụng học máy trong y học hiện đại.','Học máy (Machine Learning) đang cách mạng hóa ngành y tế.','Các mô hình CNN trong chẩn đoán hình ảnh y khoa.','Xử lý ngôn ngữ tự nhiên trong phân tích hồ sơ bệnh án.','Kết quả: độ chính xác trên 95% trong phát hiện khối u.','Thử nghiệm trên 10.000 bệnh nhân tại bệnh viện Bạch Mai.','So sánh với phương pháp chẩn đoán truyền thống.','Triển vọng: AI sẽ hỗ trợ đắc lực cho bác sĩ trong tương lai.'],createdAt:'2024-03-20'},
  {id:8,title:'Harry Potter - Hòn Đá Phù Thủy',author:'J.K. Rowling',category:'Kỳ ảo',docType:'Sách điện tử',cover:'',rating:5,featured:true,description:'Cậu bé phù thủy bước vào thế giới phép thuật.',type:'inline',pages:['Harry Potter là cậu bé mồ côi sống với gia đình Dursley đầy khắc nghiệt.','Vào sinh nhật thứ 11, Harry phát hiện ra mình là một phù thủy.','Tại Hogwarts, Harry kết bạn với Ron Weasley và Hermione Granger.','Bộ ba phát hiện ra rằng có Hòn Đá Phù Thủy được giấu trong trường.','Chúa tể Hắc ám Voldemort đang tìm cách lấy lại sức mạnh thông qua hòn đá này.','Harry, Ron và Hermione vượt qua hàng loạt thử thách để bảo vệ Hòn Đá Phù Thủy.','Câu chuyện kỳ diệu về tình bạn, lòng dũng cảm và cuộc chiến giữa thiện và ác.','Tác phẩm văn học thiếu nhi bán chạy nhất mọi thời đại với hơn 120 triệu bản.'],createdAt:'2024-01-08'},
  {id:9,title:'Nghiên Cứu Về AI Tạo Sinh',author:'Lê Hoàng Minh',category:'Công nghệ',docType:'Luận án, luận văn',cover:'',rating:5,featured:true,description:'Luận án tiến sĩ về generative AI.',type:'inline',pages:['Luận án tiến sĩ về trí tuệ nhân tạo tạo sinh (Generative AI).','Tổng quan về các mô hình generative: GAN, VAE, Diffusion.','Kiến trúc Transformer và ứng dụng trong sinh văn bản.','Mô hình ngôn ngữ lớn (LLM): GPT, BERT, LLaMA.','Thực nghiệm trên các bộ dữ liệu tiếng Việt.','Kết quả: mô hình đề xuất vượt trội so với baseline.','Ứng dụng trong giáo dục và sáng tạo nội dung.','Đóng góp mới cho lĩnh vực AI tại Việt Nam.'],createdAt:'2024-04-10'},
  {id:10,title:'Năng Lượng Tái Tạo Ở Việt Nam',author:'Phạm Thị Hương',category:'Kỹ thuật',docType:'Luận án, luận văn',cover:'',rating:4,featured:false,description:'Luận văn thạc sĩ về năng lượng tái tạo.',type:'inline',pages:['Luận văn thạc sĩ về tiềm năng năng lượng tái tạo tại Việt Nam.','Tổng quan các nguồn: mặt trời, gió, thủy điện, sinh khối.','Hiện trạng phát triển năng lượng tái tạo ở Việt Nam.','Phân tích chính sách và cơ chế khuyến khích.','Đề xuất giải pháp phát triển bền vững.','Kết quả khảo sát tại 3 tỉnh miền Trung.','So sánh chi phí với năng lượng hóa thạch.','Kiến nghị cho chiến lược năng lượng quốc gia.'],createdAt:'2024-05-05'},
  {id:11,title:'Văn Hóa Ẩm Thực Việt',author:'Hoàng Thị Mai',category:'Văn học',docType:'Bài báo khoa học',cover:'',rating:3,featured:false,description:'Nghiên cứu văn hóa ẩm thực ba miền.',type:'inline',pages:['Nghiên cứu về văn hóa ẩm thực Việt Nam dưới góc nhìn nhân học.','Ẩm thực miền Bắc: tinh tế, hài hòa, đậm chất truyền thống.','Ẩm thực miền Trung: cay nồng, đậm đà bản sắc.','Ẩm thực miền Nam: phóng khoáng, đa dạng nguyên liệu.','Phân tích yếu tố văn hóa và lịch sử trong ẩm thực.','Vai trò của ẩm thực trong đời sống tinh thần.','Ẩm thực Việt trong mắt bạn bè quốc tế.','Bảo tồn và phát huy giá trị ẩm thực truyền thống.'],createdAt:'2024-06-12'},
  {id:12,title:'Kinh Tế Số Và Chuyển Đổi Số',author:'Đặng Văn Thành',category:'Kinh tế',docType:'Bài báo khoa học',cover:'',rating:4,featured:false,description:'Tác động của kinh tế số đến doanh nghiệp Việt.',type:'inline',pages:['Bài báo về tác động của kinh tế số đến doanh nghiệp vừa và nhỏ.','Kinh tế số đóng góp 12% GDP Việt Nam năm 2023.','Các trụ cột: thương mại điện tử, fintech, giáo dục số.','Khảo sát 500 doanh nghiệp tại Hà Nội và TP.HCM.','Lợi ích: tăng năng suất, giảm chi phí vận hành.','Thách thức: thiếu nhân lực, hạ tầng công nghệ thông tin.','Đề xuất giải pháp thúc đẩy chuyển đổi số.','Kết luận: chuyển đổi số là xu hướng tất yếu.'],createdAt:'2024-07-01'}
];
const SEED_USERS = [
  { username: 'admin', password: 'admin123', role: 'Admin' },
  { username: 'giangvien', password: '123456', role: 'Giảng viên' },
  { username: 'sinhvien', password: '123456', role: 'Sinh viên' }
];

async function initData() {
  if (!fs.existsSync(BOOKS_FILE)) {
    const cloudData = await downloadJSONFromCloudinary('books');
    saveJSON(BOOKS_FILE, (cloudData && cloudData.length) ? cloudData : SEED_BOOKS);
  }
  if (!fs.existsSync(USERS_FILE)) {
    const cloudData = await downloadJSONFromCloudinary('users');
    saveJSON(USERS_FILE, (cloudData && cloudData.length) ? cloudData : SEED_USERS);
  }
}

function loadBooks() { return loadJSON(BOOKS_FILE) || []; }
function saveBooks(b) { saveJSON(BOOKS_FILE, b); uploadJSONToCloudinary(b, 'books'); }
function loadUsers() { return loadJSON(USERS_FILE) || []; }
function saveUsers(u) { saveJSON(USERS_FILE, u); uploadJSONToCloudinary(u, 'users'); }
function getNextId(books) { return books.length ? Math.max(...books.map(b => b.id)) + 1 : 1; }

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.set('trust proxy', 1);
app.use(session({
  secret: 'thu-vien-dien-tu-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: !!process.env.RENDER, sameSite: process.env.RENDER ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/covers', express.static(COVER_DIR));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
    next();
  };
}

// ---- Auth Routes ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
  req.session.user = { username: user.username, role: user.role };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/register', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
  if (username.length < 3) return res.status(400).json({ success: false, message: 'Tên đăng nhập ít nhất 3 ký tự' });
  if (password.length < 4) return res.status(400).json({ success: false, message: 'Mật khẩu ít nhất 4 ký tự' });
  const users = loadUsers();
  if (users.find(u => u.username === username)) return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
  users.push({ username, password, role });
  saveUsers(users);
  res.json({ success: true, message: 'Đăng ký thành công!' });
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Đã đăng xuất' });
});

app.get('/api/me', (req, res) => {
  if (req.session.user) return res.json({ success: true, user: req.session.user });
  res.json({ success: true, user: null });
});

// ---- Book Routes ----
app.get('/api/books', (req, res) => {
  let books = loadBooks();
  const { docType, search } = req.query;
  if (docType && docType !== 'Tất cả') books = books.filter(b => b.docType === docType);
  if (search) { const q = search.toLowerCase(); books = books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)); }
  const list = books.map(b => {
    const { pages, ...rest } = b;
    return { ...rest, coverUrl: b.cloudinaryCoverUrl || (b.coverFileName ? '/covers/' + b.coverFileName : null) };
  });
  res.json({ success: true, data: list });
});

app.get('/api/books/:id', (req, res) => {
  const book = loadBooks().find(b => b.id === parseInt(req.params.id));
  if (!book) return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
  res.json({ success: true, data: { ...book, coverUrl: book.cloudinaryCoverUrl || (book.coverFileName ? '/covers/' + book.coverFileName : null) } });
});

app.get('/api/books/:id/read', async (req, res) => {
  const book = loadBooks().find(b => b.id === parseInt(req.params.id));
  if (!book) return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
  if (book.type === 'inline' && book.pages) return res.json({ success: true, data: { type: 'inline', pages: book.pages } });
  if (book.fileUrl) return res.json({ success: true, data: { type: 'file', fileUrl: '/api/proxy/file/' + book.id, fileName: book.originalName || book.fileName, fileType: book.fileType } });
  if (book.fileName) {
    const fpath = path.join(UPLOAD_DIR, book.fileName);
    if (book.fileType === 'txt' && fs.existsSync(fpath)) {
      const content = fs.readFileSync(fpath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      const pages = []; for (let i = 0; i < lines.length; i += 20) pages.push(lines.slice(i, i + 20).join('<br>'));
      return res.json({ success: true, data: { type: 'text', pages: pages.length ? pages : ['(Nội dung trống)'] } });
    }
    if (fs.existsSync(fpath)) return res.json({ success: true, data: { type: 'file', fileUrl: '/uploads/' + book.fileName, fileName: book.originalName || book.fileName, fileType: book.fileType } });
  }
  res.json({ success: true, data: { type: 'file', fileUrl: book.fileUrl || '', fileName: book.originalName || '', fileType: book.fileType || '' } });
});

app.post('/api/books', requireRole('Admin', 'Giảng viên'), memoryUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, author, category, docType, description, uploader, featured } = req.body;
    if (!title || !author || !category) return res.status(400).json({ success: false, message: 'Vui lòng nhập tên và tác giả' });
    const books = loadBooks();
    const book = {
      id: getNextId(books), title, author, category, docType: docType || 'Sách điện tử',
      description: description || '', rating: 0, featured: featured === 'true',
      type: req.files?.file ? 'file' : 'inline',
      uploader: uploader || (req.session.user ? req.session.user.username : 'Người dùng ẩn danh'),
      createdAt: new Date().toISOString().slice(0, 10)
    };
    if (req.files?.file) {
      const f = req.files.file[0];
      book.originalName = f.originalname;
      book.fileType = path.extname(f.originalname).toLowerCase().slice(1);
      book.fileSize = f.size;
      if (USE_CLOUDINARY) {
        const result = await uploadToCloudinary(f.buffer, 'thu-vien-dien-tu/files', 'raw');
        if (result) { book.fileUrl = result.secure_url; book.cloudinaryPublicId = result.public_id; book.cloudinaryResourceType = result.resource_type; }
      } else {
        const localName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(f.originalname);
        fs.writeFileSync(path.join(UPLOAD_DIR, localName), f.buffer);
        book.fileName = localName;
      }
    }
    if (req.files?.cover) {
      const cf = req.files.cover[0];
      if (USE_CLOUDINARY) {
        const result = await uploadToCloudinary(cf.buffer, 'thu-vien-dien-tu/covers');
        if (result) { book.cloudinaryCoverUrl = result.secure_url; book.cloudinaryCoverPublicId = result.public_id; }
      } else {
        const localName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(cf.originalname);
        fs.writeFileSync(path.join(COVER_DIR, localName), cf.buffer);
        book.coverFileName = localName;
      }
    }
    books.push(book);
    saveBooks(books);
    res.json({ success: true, data: { ...book, coverUrl: book.cloudinaryCoverUrl || (book.coverFileName ? '/covers/' + book.coverFileName : null) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.put('/api/books/:id', requireRole('Admin', 'Giảng viên'), memoryUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
  try {
    const books = loadBooks();
    const idx = books.findIndex(b => b.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
    const existing = books[idx];
    const { title, author, category, docType, description, uploader, featured } = req.body;
    const updated = {
      ...existing,
      title: title || existing.title, author: author || existing.author,
      category: category || existing.category, docType: docType || existing.docType,
      description: description !== undefined ? description : existing.description,
      uploader: uploader || existing.uploader,
      featured: featured === 'true'
    };
    if (req.files?.file) {
      if (existing.cloudinaryPublicId) await destroyFromCloudinary(existing.cloudinaryPublicId);
      if (existing.fileName) { const old = path.join(UPLOAD_DIR, existing.fileName); if (fs.existsSync(old)) fs.unlinkSync(old); }
      const f = req.files.file[0];
      updated.originalName = f.originalname;
      updated.fileType = path.extname(f.originalname).toLowerCase().slice(1);
      updated.fileSize = f.size; updated.type = 'file';
      if (USE_CLOUDINARY) {
        const result = await uploadToCloudinary(f.buffer, 'thu-vien-dien-tu/files', 'raw');
        if (result) { updated.fileUrl = result.secure_url; updated.cloudinaryPublicId = result.public_id; updated.cloudinaryResourceType = result.resource_type; }
        delete updated.fileName;
      } else {
        const localName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(f.originalname);
        fs.writeFileSync(path.join(UPLOAD_DIR, localName), f.buffer);
        updated.fileName = localName;
        delete updated.fileUrl; delete updated.cloudinaryPublicId;
      }
    }
    if (req.files?.cover) {
      if (existing.cloudinaryCoverPublicId) await destroyFromCloudinary(existing.cloudinaryCoverPublicId);
      if (existing.coverFileName) { const old = path.join(COVER_DIR, existing.coverFileName); if (fs.existsSync(old)) fs.unlinkSync(old); }
      const cf = req.files.cover[0];
      if (USE_CLOUDINARY) {
        const result = await uploadToCloudinary(cf.buffer, 'thu-vien-dien-tu/covers');
        if (result) { updated.cloudinaryCoverUrl = result.secure_url; updated.cloudinaryCoverPublicId = result.public_id; }
        delete updated.coverFileName;
      } else {
        const localName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(cf.originalname);
        fs.writeFileSync(path.join(COVER_DIR, localName), cf.buffer);
        updated.coverFileName = localName;
        delete updated.cloudinaryCoverUrl; delete updated.cloudinaryCoverPublicId;
      }
    }
    books[idx] = updated;
    saveBooks(books);
    res.json({ success: true, data: { ...updated, coverUrl: updated.cloudinaryCoverUrl || (updated.coverFileName ? '/covers/' + updated.coverFileName : null) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/books/:id', requireRole('Admin', 'Giảng viên'), (req, res) => {
  const books = loadBooks();
  const idx = books.findIndex(b => b.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
  const book = books[idx];
  if (book.cloudinaryPublicId) destroyFromCloudinary(book.cloudinaryPublicId);
  if (book.cloudinaryCoverPublicId) destroyFromCloudinary(book.cloudinaryCoverPublicId);
  if (book.fileName) { const f = path.join(UPLOAD_DIR, book.fileName); if (fs.existsSync(f)) fs.unlinkSync(f); }
  if (book.coverFileName) { const f = path.join(COVER_DIR, book.coverFileName); if (fs.existsSync(f)) fs.unlinkSync(f); }
  books.splice(idx, 1);
  saveBooks(books);
  res.json({ success: true, message: 'Đã xóa tài liệu' });
});

app.get('/api/debug/file/:id', async (req, res) => {
  try {
    const book = loadBooks().find(b => b.id === parseInt(req.params.id));
    if (!book) return res.json({ success: false, message: 'Book not found' });
    const info = { id: book.id, cloudinaryPublicId: book.cloudinaryPublicId, fileUrl: book.fileUrl, cloudinaryResourceType: book.cloudinaryResourceType, USE_CLOUDINARY };
    if (book.cloudinaryPublicId && USE_CLOUDINARY) {
      for (const rt of ['raw', 'image']) {
        try { const r = await cloudinary.api.resource(book.cloudinaryPublicId, { resource_type: rt }); info['api_' + rt] = { found: true, url: r.secure_url, format: r.format, type: r.type, access_mode: r.access_mode, bytes: r.bytes }; } catch (e) { info['api_' + rt] = { found: false, error: e.message }; }
      }
      for (const rt of ['image', 'raw']) {
        try {
          const r = await cloudinary.api.resource(book.cloudinaryPublicId, { resource_type: rt });
          if (r && r.secure_url) {
            const signedUrl = cloudinary.url(r.public_id, { resource_type: rt, secure: true, sign_url: true, type: 'upload', version: r.version, format: r.format });
            const testResp = await fetch(signedUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
            info['signed_' + rt] = { url: signedUrl, status: testResp.status, statusText: testResp.statusText, xCldError: testResp.headers.get('x-cld-error') };
          }
        } catch (e) { info['signed_' + rt] = { error: e.message }; }
      }
    }
    res.json({ success: true, data: info });
  } catch (err) { res.json({ success: false, message: err.message }); }
});

// ---- Download proxy ----
app.get('/api/download/:id', (req, res) => {
  const book = loadBooks().find(b => b.id === parseInt(req.params.id));
  if (!book) return res.status(404).json({ success: false, message: 'Không tìm thấy tài liệu' });
  if (book.fileUrl) return res.redirect(book.fileUrl);
  if (book.fileName) {
    const fpath = path.join(UPLOAD_DIR, book.fileName);
    if (fs.existsSync(fpath)) return res.download(fpath, book.originalName || book.fileName);
  }
  res.status(404).json({ success: false, message: 'File không tồn tại' });
});

app.get('/api/proxy/file/:id', async (req, res) => {
  try {
    const book = loadBooks().find(b => b.id === parseInt(req.params.id));
    if (!book || (!book.fileUrl && !book.cloudinaryPublicId)) return res.status(404).json({ success: false, message: 'File không tồn tại' });

    let url = null;
    if (book.cloudinaryPublicId && USE_CLOUDINARY) {
      for (const rt of ['image', 'raw']) {
        try {
          const info = await cloudinary.api.resource(book.cloudinaryPublicId, { resource_type: rt });
          if (info && info.secure_url) {
            const signedUrl = cloudinary.url(info.public_id, { resource_type: rt, secure: true, sign_url: true, type: 'upload', version: info.version, format: info.format });
            const resp = await fetch(signedUrl, { signal: AbortSignal.timeout(10000) });
            if (resp.ok) { url = signedUrl; break; }
          }
        } catch {}
      }
    }
    if (!url) url = book.fileUrl;
    if (!url) return res.status(404).json({ success: false, message: 'File không tồn tại' });

    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return res.status(502).json({ success: false, message: 'Không thể tải file từ Cloudinary' });
    const buf = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

async function startup() {
  await initData();
  app.listen(PORT, () => {
    console.log('Thu vien Dien tu dang chay tai: http://localhost:' + PORT);
    if (USE_CLOUDINARY) console.log('Cloudinary: ON (file upload saved to cloud)');
    else console.log('Cloudinary: OFF (file upload saved locally - may lose on some hosts)');
  });
}
startup();
