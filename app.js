const express = require('express');
const path = require('path');
const userModel = require('./models/user');
const postModel = require('./models/post')
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { log } = require('console');

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render("index")
});

app.post('/register', async (req, res) => {
    let {username, name, email, age, password} = req.body;

    let user = await userModel.findOne({email});
    if (user) return res.status(500).send("USER ALREADY REGISTERED!");

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                username,
                name,
                email,
                age,
                password: hash
            });

            res.redirect("/login");
        });
    });
});

app.get('/login', (req, res) => {
    res.render("login")
});

app.post('/login', async (req, res) => {
    let {email, password} = req.body;

    let user = await userModel.findOne({email});
    if (!user) return res.status(500).send("SOMETHING WENT WRONG...!");

    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            let token = jwt.sign({email: email, userId: user._id}, "shhhh");
            res.cookie("token", token);
            res.redirect('/profile')
        }
        else {res.redirect('/login')}
    })
});

app.get('/logout', (req, res) => {
    res.cookie("token", "");
    res.redirect('/');
});

app.get('/profile', isLoggedIn, async (req, res) => {
    let theuser = await userModel.findOne({email: req.user.email}).populate("posts");
    let users = await userModel.find().populate("posts");

    res.render("profile", {theuser, users});
});

app.post('/post', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email: req.user.email});
    let {content} = req.body;

    let post = await postModel.create({
    user: user._id,
    content
    });
    user.posts.push(post._id);
    await user.save();

    res.redirect('/profile');
});

app.get('/like/:id', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email: req.user.email});
    let post = await postModel.findOne({_id: req.params.id});
    
    if (!post.likes.includes(user._id)) post.likes.push(user._id);
    else post.likes.splice(post.likes.indexOf(user._id), 1);
    
    await post.save();
    res.redirect('/profile');
});

app.get('/edit/:id', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email: req.user.email}).populate("posts");
    let post = await postModel.findOne({_id: req.params.id});
    res.render("edit", {user, post});
});

app.post('/update/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {content: req.body.content}, {new: true});
    res.redirect('/profile');
});

app.get('/delete/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndDelete({_id: req.params.id});
    console.log(post);
    res.redirect('/profile');
})

function isLoggedIn(req, res, next){
    if (req.cookies.token === "") res.send("You must be logged in!");
    else {
        let data = jwt.verify(req.cookies.token, "shhhh");
        req.user = data;
        next();
    }
}

app.listen(3000);
