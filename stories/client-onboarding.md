# Client onboarding in Right Tracker

## One login link

As a customer, I want a single Right Tracker login URL so I can bookmark it and use my own work email and password.

- Every activated customer signs in at `/login` and lands in the customer workspace.
- The first-time activation link belongs to the recipient and expires after 48 hours. After activation, the customer uses the shared login URL.

## A company account for each client

As a WisRight administrator, I want a separate organization for every client company so each person gets access to the right tickets.

- Create the company under **Organizations** and invite people to that company.
- **Own requests** allows a member to view their requests. **Organization requests** allows a manager to view requests across that company.
- A customer from one company cannot view requests or attachments from an unrelated company, even using a direct ticket link.

## Individual invitations

As a WisRight administrator, I want to invite one person by work email so they can activate their own account.

- Select a company, enter the email and access level, and send the invitation.
- If email delivery fails, the administrator can copy that recipient’s activation link.
- The recipient opens the invitation, enters their name, and sets their own password.

## Bulk invitations

As a WisRight administrator, I want to invite a group of employees to one company so I can onboard a team in one operation.

- Paste up to 25 unique addresses per batch, separated by commas or line breaks. Duplicate addresses are combined and invalid addresses are shown before submitting.
- Choose one access level per batch. Use separate batches for members and managers.
- Each recipient gets an individual invitation. Results show which invitations were emailed, which have a manual activation link, and which could not be created.
- Addresses whose invitations could not be created stay in the input for correction or retry. Invitations already created do not need to be sent again.
