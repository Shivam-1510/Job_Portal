import multer from "multer";
const storage = multer.diskStorage({});
const upload = multer({ storage });

app.post("/register", upload.single('resume'), register);
