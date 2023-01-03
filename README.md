![Flow-logo](https://user-images.githubusercontent.com/629203/210152451-3040a500-3cb2-4c5e-9695-ca78802b3329.png)

**Flow lets you make web apps for learning without writing any code.** It is like Wordpress and Squarespace, but for learning.

Apps you make with Flow look custom-designed with your own look and feel, and not a boring Qualtrics form, Coursera module, or Quizlet with differentiation.

![image](https://user-images.githubusercontent.com/629203/210153195-0ba4bde5-a128-4649-ac39-72e0a1dc9f1b.png)


Here's how it is different from other similar projects:
- **For education only**. It lets you A/B test different students' learning journeys, feedback, assessments, and hints. This helps you figure out the best way to make students learn anything digitally.
- **No code**. It is made for (1) learning science researchers, (2) teachers. Its goal is to be dead simple. You know, WYSIWYG and all that. That said, there are power features for researchers who want to create effective randomized control trials with 100% control.
- **Open source and free**. No $10/month plan for one seat. If you are not tech savvy to run it yourself, use the free version at https://flow.opencurriculum.org.


Preview
-
![Video](https://user-images.githubusercontent.com/629203/210152909-56acec83-4bf6-4179-b75d-a414266bccee.gif)

Other core features
-
1. **LTI 1.3 support**. It has support for creating assignments and then gathering the scores from a learning management system like Moodle, Blackboard, or Canvas.
2. **Blocks**. Blocks are like little plugins or widgets. They are "iframes" residing anywhere on the Internet that you can place inside your app for students to engage in, and can feed into assessing student work.
3. **Click-based events**. Make your app interactive by allowing students to click on things and see the problem or explanation change.

Supporters
-
We thank the Learning Tools Competition and all its funders (particularly, but not limited to, Schmidt Futures and The Bill and Melinda Gates Foundation, for their support for this project)


---

Installation
-

If you aren't a programmer or very tech savvy, use the hosted version of the tool. If you are, and want control, continue reading.

To run this on your computer or a server (or a NodeJS app hosting environment like Vercel), you need:

1. NodeJS (and working familiarity with the command line)
   *Flow runs on NextJS, which is a framework/environment to run ReactJS applications*
2. A Firebase account (with a new app with Firestore and Storage enabled, and a web app added which will give you credentials for later)

Once you have these, setup using the following steps:

1. Download the source code (`git clone <repository url>`), after getting the URL of this repository.

2. Navigate to it.
   ```bash
   cd flow
   ```

3. Create a file named `.env.local` and add the following (fill in the necessary values):
   ```bash
   NEXT_PUBLIC_API_KEY=<Firebase public API key>
   NEXT_PUBLIC_AUTH_DOMAIN=<Firebase auth domain>
   NEXT_PUBLIC_PROJECT_ID=<Firebase project ID>
   NEXT_PUBLIC_STORAGE_BUCKET=<Firebase storage bucket>
   NEXT_PUBLIC_MESSAGING_SENDER_ID=<Firebase messaging sender ID>
   NEXT_PUBLIC_APP_ID=<Firebase public app ID>
   NEXT_PUBLIC_MEASUREMENT_ID=<Firebase analytics ID>
   ```

4. Initialize the Firestore database collections manually.

   While there is some dummy data you can use to initialize a Firestore emulator using the command `firebase emulators:start --import=./data --only=firestore,hub`, here is a general idea of how the DB is structured, in case you have to manually generate it:
   ```javascript
   {
     "apps": [],  // Collection for apps.
     "flows": [], // Collection for flows, and steps.
     "users": [], // Collection for users and their app IDs.
     "experiments": [] // Collection for A/B tests.
   }
   ```

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Visit http://localhost:3000/admin to open the admin interface where you can start making apps. Enjoy!


Possible features roadmap
-
- [ ] Documentation / manual / how-to videos
- [ ] Add H5P Blocks
- [ ] Add readymade image graphics (assets like Canva has)
- [ ] Add OCR and webcam blocks
- [ ] Add text similarity response for short answers using language model
- [ ] Custom implement LTI support (move away from LTIAAS)
- [ ] Importing curriculum
- [ ] Custom domains for hosted version



License
-
We haven't determined the right open source license yet. So feel free to use the source in the most liberal way.


