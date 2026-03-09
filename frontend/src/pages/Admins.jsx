import { useState } from "react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function Admins(){

const [nombre,setNombre] = useState("");
const [email,setEmail] = useState("");
const [password,setPassword] = useState("");

const crearAdmin = async (e)=>{

e.preventDefault();

try{

await api.post("/admins",{
nombre,
email,
password
});

toast.success("Administrador creado");

setNombre("");
setEmail("");
setPassword("");

}catch{
toast.error("Error creando administrador");
}

};

return(

<div style={{padding:30}}>

<h2>Crear Administrador</h2>

<form onSubmit={crearAdmin}>

<input
type="text"
placeholder="Nombre"
value={nombre}
onChange={e=>setNombre(e.target.value)}
required
/>

<input
type="email"
placeholder="Email"
value={email}
onChange={e=>setEmail(e.target.value)}
required
/>

<input
type="password"
placeholder="Contraseña"
value={password}
onChange={e=>setPassword(e.target.value)}
required
/>

<button type="submit">
Crear administrador
</button>

</form>

</div>

);

}