using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BarberBookSaaS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiDiagnosisQuota : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AiDiagnosisPeriodStart",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AiDiagnosisUsed",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AiDiagnosisPeriodStart",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "AiDiagnosisUsed",
                table: "Tenants");
        }
    }
}
