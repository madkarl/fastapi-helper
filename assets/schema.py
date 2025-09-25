
class ${schema_prefix}Base(SQLModel):
    name: str = Field(max_length=255)


class ${schema_prefix}Create(${schema_prefix}Base):
    pass


class ${schema_prefix}Read(${schema_prefix}Base):
    id: ${id_type}


class ${schema_prefix}Update(${schema_prefix}Base):
    pass


class ${schema_prefix}(${schema_prefix}Base, table=True):
    id: ${id_type} = Field(${id_config})
