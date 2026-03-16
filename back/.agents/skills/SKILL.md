---
name: python-code
description: Description of what the skill does and when to use it
---

# Skill Instructions

# Python Skills & Best Practices

Este archivo contiene una lista de buenas prácticas recomendadas para trabajar con Python en este proyecto.

## Principios Generales
- Prioriza la legibilidad y simplicidad del código.
- Prefiere la claridad sobre la complejidad innecesaria.
- Usa nombres descriptivos para variables, funciones y clases.
- Comenta solo cuando el código no sea autoexplicativo.
- Mantén funciones y métodos cortos y enfocados en una sola tarea.
- Evita la duplicación de código (DRY).
- Escribe pruebas para la lógica crítica.
- Documenta módulos, clases y funciones públicas con docstrings.
- Usa tipado estático (type hints) cuando aporte claridad.

## Principios SOLID
- Aplica los principios SOLID solo cuando realmente aporten claridad, flexibilidad o mantenibilidad.
- No compliques el diseño aplicando patrones innecesarios.
- Refactoriza hacia SOLID si el código lo requiere (no desde el inicio por defecto).

## Buenas Prácticas Específicas
- Sigue la guía de estilo PEP8.
- Usa f-strings para formateo de cadenas.
- Prefiere list comprehensions y generadores para colecciones.
- Maneja excepciones de forma específica, no uses except genérico.
- Utiliza context managers (`with`) para manejo de recursos.
- Separa la lógica en módulos y paquetes coherentes.
- Mantén la configuración y secretos fuera del código fuente.

## Recursos Recomendados
- [PEP8 – Guía de estilo para Python](https://peps.python.org/pep-0008/)
- [The Zen of Python (PEP20)](https://peps.python.org/pep-0020/)
- [SOLID Principles in Python](https://realpython.com/solid-principles-python/)

---
Actualiza este archivo según evolucione el proyecto o el equipo adquiera nuevas habilidades.