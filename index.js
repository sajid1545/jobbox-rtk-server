require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

const cors = require('cors');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uqxsrr3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	serverApi: ServerApiVersion.v1,
});

const run = async () => {
	try {
		const db = client.db('jobbox');
		const userCollection = db.collection('user');
		const jobCollection = db.collection('job');

		app.post('/user', async (req, res) => {
			const user = req.body;

			const result = await userCollection.insertOne(user);

			res.send(result);
		});

		app.get('/user/:email', async (req, res) => {
			const email = req.params.email;

			const result = await userCollection.findOne({ email });

			if (result?.email) {
				return res.send({ status: true, data: result });
			}

			res.send({ status: false });
		});

		app.patch('/apply', async (req, res) => {
			const userId = req.body.userId;
			const jobId = req.body.jobId;
			const email = req.body.email;
			var createdDt = new Date();
			const filter = { _id: ObjectId(jobId) };
			const updateDoc = {
				$push: { applicants: { id: ObjectId(userId), email, createdAt: createdDt } },
			};

			const result = await jobCollection.updateOne(filter, updateDoc);

			if (result.acknowledged) {
				return res.send({ status: true, data: result });
			}

			res.send({ status: false });
		});

		app.patch('/approve', async (req, res) => {
			const jobId = req.body.jobId;
			const candidateEmail = req.body.candidateEmail;

			const filter = { _id: ObjectId(jobId) };
			const updatedDoc = {
				$push: {
					approved: {
						email: candidateEmail,
						approved: true,
					},
				},
			};
			const result = await jobCollection.updateOne(filter, updatedDoc);

			if (result.acknowledged) {
				return res.send({ status: true, data: result });
			}

			res.send({ status: false });
		});

		app.get('/applied-jobs/:email', async (req, res) => {
			const email = req.params.email;
			const query = { applicants: { $elemMatch: { email: email } } };
			const queries = req.query.sort;

			if (queries === 'firstApplied') {
				const cursor = jobCollection
					.find(query)
					.sort({ 'applicants.createdAt': 1 })
					.project({ applicants: 0 });
				const result = await cursor.toArray();

				return res.send({ status: true, data: result });
			}

			if (queries === 'lastApplied') {
				const cursor = jobCollection
					.find(query)
					.sort({ 'applicants.createdAt': -1 })
					.project({ applicants: 0 });
				const result = await cursor.toArray();

				return res.send({ status: true, data: result });
			}

			const cursor = jobCollection
				.find(query)
				.sort({ 'applicants.createdAt': 1 })
				.project({ applicants: 0 });
			const result = await cursor.toArray();

			res.send({ status: true, data: result });
		});

		app.patch('/query', async (req, res) => {
			const userId = req.body.userId;
			const jobId = req.body.jobId;
			const email = req.body.email;
			const question = req.body.question;

			const filter = { _id: ObjectId(jobId) };
			const updateDoc = {
				$push: {
					queries: {
						id: ObjectId(userId),
						email,
						question: question,
						reply: [],
					},
				},
			};

			const result = await jobCollection.updateOne(filter, updateDoc);

			if (result?.acknowledged) {
				return res.send({ status: true, data: result });
			}

			res.send({ status: false });
		});

		app.patch('/reply', async (req, res) => {
			const userId = req.body.userId;
			const reply = req.body.reply;

			const filter = { 'queries.id': ObjectId(userId) };

			const updateDoc = {
				$push: {
					'queries.$[user].reply': reply,
				},
			};
			const arrayFilter = {
				arrayFilters: [{ 'user.id': ObjectId(userId) }],
			};

			const result = await jobCollection.updateOne(filter, updateDoc, arrayFilter);
			if (result.acknowledged) {
				return res.send({ status: true, data: result });
			}

			res.send({ status: false });
		});

		// for candidate replying to employer
		app.patch('/candidate-reply', async (req, res) => {
			const candidateId = req.body.candidateId;
			const reply = req.body.reply;

			const filter = { 'queries.id': ObjectId(candidateId) };

			const updateDoc = {
				$push: {
					'queries.$[user].reply': reply,
				},
			};
			const arrayFilter = {
				arrayFilters: [{ 'user.id': ObjectId(candidateId) }],
			};

			const result = await userCollection.updateOne(filter, updateDoc, arrayFilter);
			if (result.acknowledged) {
				return res.send({ status: true, data: result });
			}

			res.send({ status: false });
		});

		// employer texting to candidate
		app.patch('/employer-text', async (req, res) => {
			const candidateId = req.body.candidateId;
			const employerId = req.body.employerId;
			const employerEmail = req.body.employerEmail;
			const employerText = req.body.employerText;

			const filter = { _id: ObjectId(candidateId) };
			const updateDoc = {
				$push: {
					queries: {
						id: ObjectId(candidateId),
						employerId: employerId,
						employerEmail: employerEmail,
						employerText: employerText,
						reply: [],
					},
				},
			};

			const result = await userCollection.updateOne(filter, updateDoc);

			if (result?.acknowledged) {
				return res.send({ status: true, data: result });
			}

			res.send({ status: false });
		});

		app.get('/jobs', async (req, res) => {
			const cursor = jobCollection.find({});
			const result = await cursor.toArray();
			res.send({ status: true, data: result });
		});

		app.get('/job/:id', async (req, res) => {
			const id = req.params.id;
			const result = await jobCollection.findOne({ _id: ObjectId(id) });
			res.send({ status: true, data: result });
		});

		app.post('/job', async (req, res) => {
			const job = req.body;

			const result = await jobCollection.insertOne(job);

			res.send({ status: true, data: result });
		});

		app.get('/job/employer-jobs/:employerID', async (req, res) => {
			const id = req.params.employerID;

			const result = await jobCollection
				.find({
					'employerInfo.id': `${ObjectId(id)}`,
				})
				.toArray();
			res.send({ status: true, data: result });
		});

		app.patch('/close-job/:jobId', async (req, res) => {
			const jobId = req.params.jobId;
			const filter = { _id: ObjectId(jobId) };
			const updatedDoc = {
				$set: {
					jobStatus: 'closed',
				},
			};
			const result = await jobCollection.updateOne(filter, updatedDoc);
			res.send({ status: true, data: result });
		});

		app.get('/candidate-details/:candidateId', async (req, res) => {
			const candidateId = req.params.candidateId;
			const result = await userCollection.findOne({ _id: ObjectId(candidateId) });
			res.send({ status: true, data: result });
		});
	} finally {
	}
};

run().catch((err) => console.log(err));

app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
