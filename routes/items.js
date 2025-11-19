var express = require('express');
var router = express.Router();
var { PrismaClient } = require('../generated/prisma');

var prisma = new PrismaClient();

// 認証ミドルウェア
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

// すべてのルートで認証を要求
router.use(requireAuth);

// 収支一覧表示
router.get('/', async function(req, res, next) {
  try {
    const userId = req.session.userId;
    const typeFilter = req.query.type || 'all'; // all, Income, Expense
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    // フィルタ条件を構築
    var whereClause = {
      userid: userId
    };
    
    if (typeFilter !== 'all') {
      whereClause.type = typeFilter;
    }
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // 終了日の23:59:59までを含める
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = endDateTime;
      }
    }
    
    // 収支項目を取得（日付の新しい順）
    const items = await prisma.item.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // サマリー計算
    var totalIncome = 0;
    var totalExpense = 0;
    
    items.forEach(item => {
      if (item.type === 'Income') {
        totalIncome += item.amount;
      } else if (item.type === 'Expense') {
        totalExpense += item.amount;
      }
    });
    
    const balance = totalIncome - totalExpense;
    
    res.render('items/index', {
      items: items,
      totalIncome: totalIncome,
      totalExpense: totalExpense,
      balance: balance,
      typeFilter: typeFilter,
      startDate: startDate,
      endDate: endDate
    });
  } catch (error) {
    console.error('Items list error:', error);
    next(error);
  }
});

// 新規作成ページ表示
router.get('/create', function(req, res, next) {
  res.render('items/create', { error: null });
});

// 新規作成処理
router.post('/create', async function(req, res, next) {
  try {
    const userId = req.session.userId;
    const { amount, type, event, memo } = req.body;
    
    if (!amount || !type || !event) {
      return res.render('items/create', { error: '金額、収支区分、項目名は必須です' });
    }
    
    if (type !== 'Income' && type !== 'Expense') {
      return res.render('items/create', { error: '収支区分は「収入」または「支出」を選択してください' });
    }
    
    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.render('items/create', { error: '金額は正の数値を入力してください' });
    }
    
    await prisma.item.create({
      data: {
        userid: userId,
        amount: amountNum,
        type: type,
        event: event,
        memo: memo || null
      }
    });
    
    res.redirect('/items');
  } catch (error) {
    console.error('Create item error:', error);
    res.render('items/create', { error: '登録に失敗しました' });
  }
});

// 編集ページ表示
router.get('/edit/:id', async function(req, res, next) {
  try {
    const userId = req.session.userId;
    const itemId = parseInt(req.params.id);
    
    const item = await prisma.item.findFirst({
      where: {
        id: itemId,
        userid: userId
      }
    });
    
    if (!item) {
      return res.status(404).send('項目が見つかりません');
    }
    
    res.render('items/edit', { item: item, error: null });
  } catch (error) {
    console.error('Edit page error:', error);
    next(error);
  }
});

// 編集処理
router.post('/edit/:id', async function(req, res, next) {
  try {
    const userId = req.session.userId;
    const itemId = parseInt(req.params.id);
    const { amount, type, event, memo } = req.body;
    
    // 項目が存在し、ユーザーが所有しているか確認
    const existingItem = await prisma.item.findFirst({
      where: {
        id: itemId,
        userid: userId
      }
    });
    
    if (!existingItem) {
      return res.status(404).send('項目が見つかりません');
    }
    
    if (!amount || !type || !event) {
      return res.render('items/edit', { 
        item: existingItem, 
        error: '金額、収支区分、項目名は必須です' 
      });
    }
    
    if (type !== 'Income' && type !== 'Expense') {
      return res.render('items/edit', { 
        item: existingItem, 
        error: '収支区分は「収入」または「支出」を選択してください' 
      });
    }
    
    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.render('items/edit', { 
        item: existingItem, 
        error: '金額は正の数値を入力してください' 
      });
    }
    
    await prisma.item.update({
      where: { id: itemId },
      data: {
        amount: amountNum,
        type: type,
        event: event,
        memo: memo || null
      }
    });
    
    res.redirect('/items');
  } catch (error) {
    console.error('Update item error:', error);
    next(error);
  }
});

// 削除処理
router.post('/delete/:id', async function(req, res, next) {
  try {
    const userId = req.session.userId;
    const itemId = parseInt(req.params.id);
    
    // 項目が存在し、ユーザーが所有しているか確認
    const existingItem = await prisma.item.findFirst({
      where: {
        id: itemId,
        userid: userId
      }
    });
    
    if (!existingItem) {
      return res.status(404).send('項目が見つかりません');
    }
    
    await prisma.item.delete({
      where: { id: itemId }
    });
    
    res.redirect('/items');
  } catch (error) {
    console.error('Delete item error:', error);
    next(error);
  }
});

// 詳細表示
router.get('/detail/:id', async function(req, res, next) {
  try {
    const userId = req.session.userId;
    const itemId = parseInt(req.params.id);
    
    const item = await prisma.item.findFirst({
      where: {
        id: itemId,
        userid: userId
      }
    });
    
    if (!item) {
      return res.status(404).send('項目が見つかりません');
    }
    
    res.render('items/detail', { item: item });
  } catch (error) {
    console.error('Detail page error:', error);
    next(error);
  }
});

module.exports = router;

