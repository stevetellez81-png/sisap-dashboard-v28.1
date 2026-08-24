SISAP Dashboard V31.4.5

Corrección Cargabilidad / Asignaciones:
- Cargabilidad ahora solo muestra proyectos con asignación vigente en project_assignments.
- Las filas antiguas de weekly_project_load ya no pueden recrear una asignación eliminada.
- Al retirar un analista de un proyecto, se limpian proyecciones actuales/futuras y filas vacías.
- Se conserva histórico pasado con horas registradas.
- Guardar Cargabilidad valida nuevamente que la asignación siga vigente.
- KPIs de capacidad ignoran cargas huérfanas.

SQL opcional recomendado:
  supabase_v31_4_5_cleanup_orphan_loads.sql
Este script limpia residuos existentes en la base de datos de forma conservadora.
La aplicación funciona sin ejecutarlo, pero se recomienda una vez para sanear datos antiguos.
