import './UsersList.css';

const UsersList = ({ users }) => {
  return (
    <div className="users-list">
      <h3>Online Users ({users.length})</h3>
      <ul>
        {users.map((user, index) => (
          <li key={index}>
            <span className="online-indicator"></span>
            {user.userName}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UsersList;
