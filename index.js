const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(cors())
app.use(express.json())


// connect with mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gflzo.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// token verify 
function verifyJWT(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unAuthorize access' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('booking');
        const userCollection = client.db('doctors_portal').collection('user');
        const doctorsCollection = client.db('doctors_portal').collection('doctors');
        const verifyAdmin = async (req, res, next) =>{
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if(requesterAccount.role === 'admin'){
                next();
            } else{
                res.status(403).send({message: 'forbidden'});

            }
        }
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query).project({name: 1});
            const services = await cursor.toArray();
            res.send(services)
        });
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        });
        app.get('/admin/:email', async (req, res) =>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin})
        })
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);

        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            console.log(user);
            const filter = { email: email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token })
        })
        app.get('/doctors', verifyJWT, verifyAdmin, async(req, res) =>{
            const doctors = await doctorsCollection.find().toArray();
            res.send(doctors);
          })
        app.post('/doctors', verifyJWT, verifyAdmin,  async (req, res) =>{
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor);
            res.send(result);
        })
        app.delete('/doctors/:email', verifyJWT, verifyAdmin,  async (req, res) =>{
            const email = req.params.email;
            const filter = {email: email}
            const result = await doctorsCollection.deleteOne(filter);
            res.send(result);
        })


        // this is not the proper way to  query.
        //After learning more about mongodb . use aggrreegrate lookup pipeline match group

        app.get('/available', async (req, res) => {
            const data = req.query.data;
            //step 1: get all services

            const service = await serviceCollection.find().toArray();
            //step: 2 get the booking off the day

            const query = { date: data };
            const bookings = await bookingCollection.find(query).toArray();
            // step 3: for ech  service , find booking for  that service

            service.forEach(service => {
                // step: 4 find booking for the server

                const serviceBooking = bookings.filter(book => book.treatment === service.name);
                // step: 5 select slots for the bookings:['', '', '',]

                const bookedSlots = serviceBooking.map(book => book.slot)
                // step: 6 select those slots thst sre not  in bookedslots

                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                service.slots = available;
            })
            res.send(service)
        })
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient == decodedEmail) {
                const query = { patient: patient };
                const booking = await bookingCollection.find(query).toArray();
                return res.send(booking)
            } else {
                return res.status(403).send({ message: 'Forbidden access' })
            }
        })
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking)
            return res.send({ success: true, result });
        })
    }
    finally {

    }


}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello Doctor Uncle!')
})

app.listen(port, () => {
    console.log(`Doctor  app listening on port ${port}`)
})