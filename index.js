const express = require("express");
const app = express();
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan("dev"));

// const uri = "mongodb://localhost:27017";
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yq2vgbi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
  // maxPoolSize: 10,
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(403)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];

  if (!token) {
    return res
      .status(403)
      .send({ error: true, message: "unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(403)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const usersCollection = client.db("aircncDB").collection("users");
    const roomsCollection = client.db("aircncDB").collection("rooms");
    const bookingsCollection = client.db("aircncDB").collection("bookings");

    // TODO: Generate client secret
    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;

      if (price) {
        const amount = parseFloat(price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    });

    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.JWT_ACCESS_TOKEN, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    app.get("/all-rooms", async (req, res) => {
      try {
        const result = await roomsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.get("/my-bookings-room/:email", async (req, res) => {
      try {
        const email = req.params.email;
        if (!email) {
          res.send([]);
        }
        const query = { "guest.email": email };
        const result = await bookingsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.delete("/delete-booking/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await bookingsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.delete("/delete-room/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await roomsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      try {
        const result = await roomsCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // GET HOSTED ROOM
    app.get("/rooms/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { "host.email": email };

      try {
        const result = await roomsCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // ROOM UPDATE
    app.put("/room-update/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updateData = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            updateData,
          },
        };

        const result = await roomsCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    /* ----------------------- save room data in database ----------------------- */
    app.post("/add-rooms", async (req, res) => {
      try {
        const result = await roomsCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    /* -------------------------------- GET USER -------------------------------- */
    app.get("/user/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const query = { email: email };

        const result = await usersCollection.findOne(query);

        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // BOOKING ROOM SET IN DATABASE
    app.post("/room-bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    // GET HOSTED BOOKING ROOM
    app.get("/booked-room", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { host: email };
        if (!email) {
          res.send([]);
        }
        const result = await bookingsCollection.find(query).toArray();
        console.log({ result });
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // SPECIFIC USER DATA UPDATE TODO: not used
    app.put("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = req.body;
        const filter = { email: email };
        console.log(filter);
        const options = {
          upsert: true,
        };
        const updateDoc = {
          $set: user,
        };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          options
        );

        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // UPDATE ROOM BOOKING STATUS
    app.patch("/room/status/:id", async (req, res) => {
      const { id } = req.params;
      const status = req.body.status;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          booked: status,
        },
      };
      const result = await roomsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("AirCNC Server is running..");
});

app.listen(port, () => {
  console.log(`AirCNC is running on port ${port}`);
});
