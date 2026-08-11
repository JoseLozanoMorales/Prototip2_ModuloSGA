--
-- PostgreSQL database dump
--

\restrict gI2l4E5oxSueb0LmytcVSwwBl8YcigA4WkHA6yYq5K5JpCdAeWcPLDyjQZ9sWL3

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: modulo_editores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modulo_editores (
    id_editor bigint NOT NULL,
    id_usuario_externo bigint NOT NULL,
    nombre_usuario text,
    activo boolean DEFAULT true NOT NULL,
    asignado_por bigint,
    fecha_asignacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: modulo_editores_id_editor_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.modulo_editores_id_editor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: modulo_editores_id_editor_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.modulo_editores_id_editor_seq OWNED BY public.modulo_editores.id_editor;


--
-- Name: modulo_editores id_editor; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_editores ALTER COLUMN id_editor SET DEFAULT nextval('public.modulo_editores_id_editor_seq'::regclass);


--
-- Name: modulo_editores modulo_editores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_editores
    ADD CONSTRAINT modulo_editores_pkey PRIMARY KEY (id_editor);


--
-- Name: modulo_editores uq_modulo_editor_usuario; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modulo_editores
    ADD CONSTRAINT uq_modulo_editor_usuario UNIQUE (id_usuario_externo);


--
-- PostgreSQL database dump complete
--

\unrestrict gI2l4E5oxSueb0LmytcVSwwBl8YcigA4WkHA6yYq5K5JpCdAeWcPLDyjQZ9sWL3

