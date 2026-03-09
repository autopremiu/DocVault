import { useEffect, useState } from "react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function Admins(){

  const [admins,setAdmins] = useState([]);
  const [form,setForm] = useState({
    nombre:"",
    email:"",
    password:""
  });

  const cargarAdmins = async ()=>{
    try{
      const {data} = await api.get("/admins");
      setAdmins(data);
    }catch{
      toast.error("Error cargando administradores");
    }
  };

  useEffect(()=>{
    cargarAdmins();
  },[]);

  const crearAdmin = async(e)=>{
    e.preventDefault();

    try{

      await api.post("/admins",form);

      toast.success("Administrador creado");

      setForm({
        nombre:"",
        email:"",
        password:""
      });

      cargarAdmins();

    }catch(err){

      toast.error(err.response?.data?.error || "Error");

    }

  };

  const desactivar = async(id)=>{

    try{

      await api.patch(`/admins/${id}/desactivar`);

      toast.success("Administrador desactivado");

      cargarAdmins();

    }catch{

      toast.error("Error");

    }

  };

  const activar = async(id)=>{

    try{

      await api.patch(`/admins/${id}/activar`);

      toast.success("Administrador activado");

      cargarAdmins();

    }catch{

      toast.error("Error");

    }

  };

  return(

    <div style={{padding:30}}>

      <h2>Administradores</h2>

      {/* FORMULARIO */}

      <form onSubmit={crearAdmin} style={{marginBottom:30}}>

        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={e=>setForm({...form,nombre:e.target.value})}
        />

        <input
          placeholder="Email"
          value={form.email}
          onChange={e=>setForm({...form,email:e.target.value})}
        />

        <input
          placeholder="Contraseña"
          type="password"
          value={form.password}
          onChange={e=>setForm({...form,password:e.target.value})}
        />

        <button type="submit">
          Crear administrador
        </button>

      </form>


      {/* TABLA */}

      <table>

        <thead>

          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>

        </thead>

        <tbody>

          {admins.map(admin=>(

            <tr key={admin.id}>

              <td>{admin.id}</td>

              <td>{admin.nombre}</td>

              <td>{admin.email}</td>

              <td>
                {admin.activo ? "Activo" : "Desactivado"}
              </td>

              <td>

                {admin.activo ? (

                  <button
                    onClick={()=>desactivar(admin.id)}
                  >
                    Desactivar
                  </button>

                ) : (

                  <button
                    onClick={()=>activar(admin.id)}
                  >
                    Activar
                  </button>

                )}

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}