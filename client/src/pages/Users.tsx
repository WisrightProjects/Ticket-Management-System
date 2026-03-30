import Navbar from "@/components/Navbar";

function Users() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold">User Management</h2>
      </main>
    </div>
  );
}

export default Users;
