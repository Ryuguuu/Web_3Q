var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var { PrismaClient } = require('../generated/prisma');

var prisma = new PrismaClient();

// ログインページ表示
router.get('/login', function(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/items');
  }
  res.render('auth/login', { error: null });
});

// ログイン処理
router.post('/login', async function(req, res, next) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.render('auth/login', { error: 'メールアドレスとパスワードを入力してください' });
    }
    
    const user = await prisma.user.findUnique({
      where: { email: email }
    });
    
    if (!user) {
      return res.render('auth/login', { error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.render('auth/login', { error: 'メールアドレスまたはパスワードが正しくありません' });
    }
    
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    res.redirect('/items');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'ログインに失敗しました' });
  }
});

// 新規登録ページ表示
router.get('/register', function(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/items');
  }
  res.render('auth/register', { error: null });
});

// 新規登録処理
router.post('/register', async function(req, res, next) {
  try {
    const { email, password, confirmPassword } = req.body;
    
    if (!email || !password || !confirmPassword) {
      return res.render('auth/register', { error: 'すべての項目を入力してください' });
    }
    
    if (password !== confirmPassword) {
      return res.render('auth/register', { error: 'パスワードが一致しません' });
    }
    
    if (password.length < 6) {
      return res.render('auth/register', { error: 'パスワードは6文字以上で入力してください' });
    }
    
    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email: email }
    });
    
    if (existingUser) {
      return res.render('auth/register', { error: 'このメールアドレスは既に登録されています' });
    }
    
    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ユーザーを作成
    const user = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword
      }
    });
    
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    res.redirect('/items');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', { error: '登録に失敗しました' });
  }
});

// ログアウト処理
router.post('/logout', function(req, res, next) {
  req.session.destroy(function(err) {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/auth/login');
  });
});

module.exports = router;

