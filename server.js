// server.js

const bcrypt = require('bcrypt');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const port = 3000;

// =======================================================
// 1. DATABASE CONFIGURATION
// *******************************************************
// 🛑 IMPORTANT: Agar aapka root password 12345 nahi hai,
// toh "12345" ki jagah apna SAHI password daalein.
// *******************************************************
const db = mysql.createPool({
    host: '127.0.0.1', 
    user: 'root', 
    password: 'awais786@uw&&&', // <--- YAHAN PASSWORD CHANGE KIYA GAYA HAI
    database: 'ecommerce', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000, 
    // insecureAuth: true  <--- Is line ko hata diya gaya hai
});
// =======================================================

// Middleware Setup
app.use(express.json()); 
app.use(cors());

// =======================================================
// 2. PRODUCT ROUTES (Image URL support added)
// =======================================================

app.get('/', (req, res) => {
    res.send('Server is Running and Database Connection is Ready!');
});

app.get('/products', (req, res) => {
    // NOTE: image_url ko bhi SELECT kiya ja raha hai
    const sqlQuery = 'SELECT id, name, price, description, stock, image_url FROM products'; 
    db.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('An error occurred during the database query (Products):', err);
            return res.status(500).json({ error: 'Problem fetching data from the database.' });
        }
        
        // Price conversion is correct here.
        const safeResults = results.map(product => ({
            ...product,
            price: Number(product.price) 
        }));

        res.status(200).json(safeResults);
    });
});

app.get('/products/:id', (req, res) => {
    const productId = req.params.id; 
    const sqlQuery = 'SELECT id, name, price, description, stock, image_url FROM products WHERE id = ?';
    
    db.query(sqlQuery, [productId], (err, results) => {
        if (err) {
            console.error('Error fetching product by ID:', err);
            return res.status(500).json({ error: 'Problem fetching data from the database.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product is not found.' });
        }
        
        const product = results[0];
        // Price conversion is correct here.
        product.price = Number(product.price);

        res.status(200).json(product);
    });
});

app.post('/products', (req, res) => {
    // ✅ UPDATED: image_url ko destructure kiya gaya hai
    const { name, price, description, stock, image_url } = req.body; 
    
    // ✅ UPDATED: image_url ko query mein add kiya gaya hai
    const sqlQuery = 'INSERT INTO products (name, price, description, stock, image_url) VALUES (?, ?, ?, ?, ?)';
    const values = [name, price, description, stock, image_url || null]; // Agar image_url nahi hai toh NULL set hoga

    db.query(sqlQuery, values, (err, result) => {
        if (err) {
            console.error('Error inserting product:', err);
            return res.status(500).json({ error: 'Failed to add product to database.' });
        }
        res.status(201).json({ 
            message: 'Product added successfully!',
            productId: result.insertId 
        });
    });
});

app.put('/products/:id', (req, res) => {
    const productId = req.params.id;
    // ✅ UPDATED: image_url ko destructure kiya gaya hai
    const { name, price, description, stock, image_url } = req.body; 
    
    // ✅ UPDATED: image_url ko UPDATE query mein add kiya gaya hai
    const sqlQuery = 'UPDATE products SET name = ?, price = ?, description = ?, stock = ?, image_url = ? WHERE id = ?';
    const values = [name, price, description, stock, image_url || null, productId]; // image_url || null taki NULL save ho sake

    db.query(sqlQuery, values, (err, result) => {
        if (err) {
            console.error('Error updating product:', err);
            return res.status(500).json({ error: 'Failed to update product.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product is not found or no changes were made.' });
        }
        res.status(200).json({ message: 'Product updated successfully.' });
    });
});

app.delete('/products/:id', (req, res) => {
    const productId = req.params.id;
    const sqlQuery = 'DELETE FROM products WHERE id = ?';

    db.query(sqlQuery, [productId], (err, result) => {
        if (err) {
            console.error('Error deleting product:', err);
            return res.status(500).json({ error: 'Failed to delete product.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        res.status(200).json({ message: 'Product deleted successfully.' });
    });
});


// =======================================================
// 3. AUTHENTICATION ROUTES (No change needed)
// =======================================================

app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide username, email, and password.' });
    }

    bcrypt.hash(password, 10, (err, hash) => { 
        if (err) {
            console.error('Hashing error:', err);
            return res.status(500).json({ error: 'Failed to hash password.' });
        }
        
        const sqlQuery = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
        const values = [username, email, hash]; 

        db.query(sqlQuery, values, (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Username or Email already exists.' });
                }
                console.error('Registration error:', err);
                return res.status(500).json({ error: 'Registration failed due to server error.' });
            }

            res.status(201).json({ message: 'User registered successfully!', userId: result.insertId });
        });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
    }

    const sqlQuery = 'SELECT * FROM users WHERE email = ?';
    
    db.query(sqlQuery, [email], (err, results) => {
        if (err) {
            console.error('Login query error:', err);
            return res.status(500).json({ error: 'Login failed due to server error.' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' }); 
        }

        const user = results[0];
        
        bcrypt.compare(password, user.password_hash, (err, isMatch) => {
            if (err) {
                console.error('Compare error:', err);
                return res.status(500).json({ error: 'Login verification failed.' });
            }

            if (isMatch) {
                res.status(200).json({ 
                    message: 'Login successful!', 
                    userId: user.id,
                    username: user.username
                });
            } else {
                res.status(401).json({ error: 'Invalid email or password.' });
            }
        });
    });
});


// =======================================================
// 4. ORDER MANAGEMENT ROUTES (No change needed)
// =======================================================

app.post('/order', (req, res) => {
    const { user_id, items } = req.body; 

    if (!user_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'User ID and cart items are required.' });
    }

    let total_amount = 0;
    for (const item of items) {
        // client se aane wale price ko Number mein convert kiya gaya.
        total_amount += Number(item.price) * item.quantity; 
    }

    db.getConnection((err, connection) => {
        if (err) {
            console.error('Connection error:', err);
            return res.status(500).json({ error: 'Database connection failed for transaction.' });
        }

        connection.beginTransaction(err => {
            if (err) {
                connection.release();
                return res.status(500).json({ error: 'Failed to start transaction.' });
            }

            const orderSql = 'INSERT INTO orders (user_id, total_amount) VALUES (?, ?)';
            connection.query(orderSql, [user_id, total_amount], (err, orderResult) => {
                if (err) {
                    return connection.rollback(() => {
                        connection.release();
                        res.status(500).json({ error: 'Failed to create order record.' });
                    });
                }

                const order_id = orderResult.insertId;
                
                const detailPromises = items.map(item => {
                    return new Promise((resolve, reject) => {
                        
                        // item.price ko Number mein convert kiya gaya.
                        const price_at_order_safe = Number(item.price);

                        const detailSql = 'INSERT INTO order_details (order_id, product_id, quantity, price_at_order) VALUES (?, ?, ?, ?)';
                        const detailValues = [order_id, item.product_id, item.quantity, price_at_order_safe];
                        
                        connection.query(detailSql, detailValues, (err) => {
                            if (err) return reject(err);

                            const stockSql = 'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?';
                            connection.query(stockSql, [item.quantity, item.product_id, item.quantity], (err, stockResult) => {
                                if (err) return reject(err);
                                
                                if (stockResult.affectedRows === 0) {
                                    return reject(new Error('Insufficient stock or product not found.'));
                                }
                                resolve();
                            });
                        });
                    });
                });

                Promise.all(detailPromises)
                    .then(() => {
                        connection.commit(err => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    res.status(500).json({ error: 'Failed to commit order.' });
                                });
                            }
                            connection.release();
                            res.status(201).json({ message: 'Order placed successfully!', orderId: order_id });
                        });
                    })
                    .catch(error => {
                        connection.rollback(() => {
                            connection.release();
                            res.status(400).json({ error: error.message || 'Error occurred during order processing.' });
                        });
                    });
            });
        });
    });
});


app.get('/myorders/:userId', async (req, res) => {
    const userId = req.params.userId;

    const ordersSql = 'SELECT id, total_amount, order_date FROM orders WHERE user_id = ? ORDER BY order_date DESC';
    
    db.query(ordersSql, [userId], (err, orders) => {
        if (err) {
            console.error('Error fetching orders:', err);
            return res.status(500).json({ error: 'Problem retrieving order history.' });
        }
        
        if (orders.length === 0) {
            return res.status(200).json([]); // Frontend expects an empty array []
        }

        const ordersWithDetails = [];
        let completedQueries = 0;

        orders.forEach(order => {
            // total_amount ko Number mein convert kiya gaya.
            order.total_amount = Number(order.total_amount); 

            const detailsSql = 'SELECT od.quantity, od.price_at_order, p.name AS product_name FROM order_details od JOIN products p ON od.product_id = p.id WHERE od.order_id = ?';
            
            db.query(detailsSql, [order.id], (detailErr, details) => {
                if (detailErr) {
                    console.error('Error fetching order details:', detailErr);
                }

                // price_at_order ko Number mein convert kiya gaya.
                const safeDetails = (details || []).map(item => ({
                    ...item,
                    price_at_order: Number(item.price_at_order)
                }));

                order.items = safeDetails;
                ordersWithDetails.push(order);
                completedQueries++;

                if (completedQueries === orders.length) {
                    res.status(200).json(ordersWithDetails);
                }
            });
        });
    });
});


// =======================================================
// 5. SERVER STARTUP & CRITICAL DB CHECK
// =======================================================

app.listen(port, () => {
    console.log(`\n=============================================`);
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`=============================================`);
    
    // Database connection check
    db.getConnection((err, connection) => {
        if (err) {
            console.error('\n❌ CRITICAL DB ERROR: Could not connect to MySQL!');
            console.error('   -> Error Code:', err.code); 
            console.error('   -> Error Message:', err.message); 
            console.error('   -> HINT: MySQL service (Workbench se) chala hua hai?'); 
            console.error('   -> HINT: Server.js mein user aur password check karein (Default: root aur khali).');
            console.error('=============================================\n');
            return; 
        }
        
        console.log(`✅ Database connection successful! (Connection ID: ${connection.threadId})`);
        console.log('=============================================\n');
        connection.release(); 
    });
});