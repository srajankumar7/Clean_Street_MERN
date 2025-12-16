import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();
  useEffect(() => {
    // Redirect to /login but open the register side of the card
    navigate("/login?mode=register", { replace: true });
  }, [navigate]);

  return null;
};

export default Register;
